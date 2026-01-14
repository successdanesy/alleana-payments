const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

const RATE_PER_MINUTE = 50.00;

const initiateCall = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: errors.array() } });
    }

    const { receiver_id } = req.body;
    const caller_id = req.user.id;

    if (caller_id === receiver_id) {
        return res.status(400).json({ success: false, error: { code: 'SELF_CALL_NOT_ALLOWED', message: 'Cannot call yourself' } });
    }

    try {
        const receiverExists = await db.query('SELECT id FROM users WHERE id = $1', [receiver_id]);
        if (receiverExists.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receiver not found' } });
        }

        const callerWallet = await db.query('SELECT id, balance FROM wallets WHERE user_id = $1', [caller_id]);
        if (callerWallet.rows.length === 0 || callerWallet.rows[0].balance < RATE_PER_MINUTE) {
            return res.status(402).json({ 
                success: false, 
                error: { 
                    code: 'INSUFFICIENT_BALANCE', 
                    message: 'Your wallet balance is insufficient for this call',
                    details: { required: RATE_PER_MINUTE, available: callerWallet.rows[0]?.balance || 0 }
                } 
            });
        }
        
        const call = await db.query(
            'INSERT INTO call_sessions (caller_id, receiver_id, status, rate_per_minute) VALUES ($1, $2, $3, $4) RETURNING id, caller_id, receiver_id, status, rate_per_minute',
            [caller_id, receiver_id, 'initiated', RATE_PER_MINUTE]
        );

        res.status(201).json({
            success: true,
            data: {
                ...call.rows[0],
                your_balance: parseFloat(callerWallet.rows[0].balance)
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const answerCall = async (req, res) => {
    const { call_id } = req.params;
    const receiver_id = req.user.id;

    try {
        const callResult = await db.query('SELECT * FROM call_sessions WHERE id = $1', [call_id]);
        if (callResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call session not found' } });
        }

        const call = callResult.rows[0];

        if (call.receiver_id !== receiver_id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not the receiver of this call' } });
        }

        if (call.status !== 'initiated' && call.status !== 'ringing') {
             return res.status(409).json({ success: false, error: { code: 'CALL_ALREADY_ANSWERED_OR_ENDED', message: 'Call cannot be answered' } });
        }

        const updatedCall = await db.query(
            'UPDATE call_sessions SET status = $1, started_at = NOW() WHERE id = $2 RETURNING id, status, started_at',
            ['ongoing', call_id]
        );

        res.status(200).json({ success: true, data: updatedCall.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const endCall = async (req, res) => {
    const { call_id } = req.params;
    const user_id = req.user.id;
    const { reason } = req.body;

    try {
        const callResult = await db.query('SELECT * FROM call_sessions WHERE id = $1', [call_id]);
        if (callResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call session not found' } });
        }

        let call = callResult.rows[0];

        if (call.caller_id !== user_id && call.receiver_id !== user_id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not a participant in this call' } });
        }

        if (call.status === 'ended') {
            return res.status(409).json({ success: false, error: { code: 'CALL_ALREADY_ENDED', message: 'This call has already ended' } });
        }

        const ended_at = new Date();
        let duration_seconds = 0;
        let billed_minutes = 0;
        let total_charge = 0;

        if (call.status === 'ongoing') {
            duration_seconds = Math.round((ended_at - new Date(call.started_at)) / 1000);
            billed_minutes = Math.ceil(duration_seconds / 60);
            total_charge = billed_minutes * call.rate_per_minute;
            
            const callerWalletResult = await db.query('SELECT id FROM wallets WHERE user_id = $1', [call.caller_id]);
            const caller_wallet_id = callerWalletResult.rows[0].id;

            await db.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [total_charge, caller_wallet_id]);
            
            await db.query(
                'INSERT INTO transactions (wallet_id, type, amount, reference, status, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
                [caller_wallet_id, 'call_charge', total_charge, `CALL_${call.id}`, 'completed', { call_id: call.id }]
            );
        }

        const updateQuery = `
            UPDATE call_sessions 
            SET status = 'ended', ended_at = $1, duration_seconds = $2, billed_minutes = $3, total_charge = $4, end_reason = $5
            WHERE id = $6
            RETURNING id, status, duration_seconds, billed_minutes, total_charge, end_reason
        `;
        const updatedCallResult = await db.query(updateQuery, [ended_at, duration_seconds, billed_minutes, total_charge, reason, call_id]);

        res.status(200).json({ success: true, data: updatedCallResult.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const getCallDetails = async (req, res) => {
    const { call_id } = req.params;
    const user_id = req.user.id;

    try {
        const callResult = await db.query('SELECT * FROM call_sessions WHERE id = $1', [call_id]);
        if (callResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call session not found' } });
        }

        const call = callResult.rows[0];

        if (call.caller_id !== user_id && call.receiver_id !== user_id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not a participant of this call' } });
        }

        res.status(200).json({ success: true, data: call });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const getCallHistory = async (req, res) => {
    const user_id = req.user.id;
    const { page = 1, limit = 20, role = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let roleFilter = '';
    if (role === 'caller') {
        roleFilter = 'AND caller_id = $1';
    } else if (role === 'receiver') {
        roleFilter = 'AND receiver_id = $1';
    } else {
        roleFilter = 'AND (caller_id = $1 OR receiver_id = $1)';
    }

    try {
        const historyQuery = `
            SELECT * FROM call_sessions 
            WHERE 1=1 ${roleFilter}
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3
        `;
        const totalQuery = `SELECT COUNT(*) FROM call_sessions WHERE 1=1 ${roleFilter}`;

        const historyResult = await db.query(historyQuery, [user_id, limit, offset]);
        const totalResult = await db.query(totalQuery, [user_id]);
        
        res.status(200).json({
            success: true,
            data: {
                calls: historyResult.rows,
                pagination: {
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    total: parseInt(totalResult.rows[0].count, 10)
                }
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};


module.exports = {
    initiateCall,
    answerCall,
    endCall,
    getCallDetails,
    getCallHistory,
};
