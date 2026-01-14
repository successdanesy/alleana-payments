const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const store = require('../utils/inMemoryStore');

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
        const receiverExists = store.users.find(u => u.id === receiver_id);
        if (!receiverExists) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receiver not found' } });
        }

        const callerWallet = store.wallets.find(w => w.user_id === caller_id);
        if (!callerWallet || callerWallet.balance < RATE_PER_MINUTE) {
            return res.status(402).json({ 
                success: false, 
                error: { 
                    code: 'INSUFFICIENT_BALANCE', 
                    message: 'Your wallet balance is insufficient for this call',
                    details: { required: RATE_PER_MINUTE, available: callerWallet?.balance || 0 }
                } 
            });
        }
        
        const newCall = {
            id: uuidv4(),
            caller_id,
            receiver_id,
            status: 'initiated',
            rate_per_minute: RATE_PER_MINUTE,
            created_at: new Date(),
            started_at: null,
            ended_at: null,
            duration_seconds: 0,
            billed_minutes: 0,
            total_charge: 0,
            end_reason: null,
        };
        store.call_sessions.push(newCall);

        res.status(201).json({
            success: true,
            data: {
                call_id: newCall.id,
                caller_id: newCall.caller_id,
                receiver_id: newCall.receiver_id,
                status: newCall.status,
                rate_per_minute: newCall.rate_per_minute,
                your_balance: parseFloat(callerWallet.balance)
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
        const call = store.call_sessions.find(c => c.id === call_id);
        if (!call) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call session not found' } });
        }

        if (call.receiver_id !== receiver_id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not the receiver of this call' } });
        }

        if (call.status !== 'initiated' && call.status !== 'ringing') {
             return res.status(409).json({ success: false, error: { code: 'CALL_ALREADY_ANSWERED_OR_ENDED', message: 'Call cannot be answered' } });
        }

        call.status = 'ongoing';
        call.started_at = new Date();

        res.status(200).json({ success: true, data: { id: call.id, status: call.status, started_at: call.started_at } });

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
        const call = store.call_sessions.find(c => c.id === call_id);
        if (!call) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call session not found' } });
        }

        if (call.caller_id !== user_id && call.receiver_id !== user_id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not a participant in this call' } });
        }

        if (call.status === 'ended') {
            return res.status(409).json({ success: false, error: { code: 'CALL_ALREADY_ENDED', message: 'This call has already ended' } });
        }

        call.ended_at = new Date();
        call.status = 'ended';
        call.end_reason = reason;

        if (call.started_at) { // Only bill if the call was actually ongoing
            call.duration_seconds = Math.round((call.ended_at - call.started_at) / 1000);
            call.billed_minutes = Math.ceil(call.duration_seconds / 60);
            call.total_charge = call.billed_minutes * call.rate_per_minute;
            
            const callerWallet = store.wallets.find(w => w.user_id === call.caller_id);
            if (callerWallet) {
                callerWallet.balance -= call.total_charge;
                callerWallet.updated_at = new Date();

                const newTransaction = {
                    id: uuidv4(),
                    wallet_id: callerWallet.id,
                    type: 'call_charge',
                    amount: call.total_charge,
                    reference: `CALL_${call.id}`,
                    status: 'completed',
                    metadata: { call_id: call.id },
                    created_at: new Date(),
                };
                store.transactions.push(newTransaction);
            }
        }

        res.status(200).json({ 
            success: true, 
            data: { 
                call_id: call.id, 
                status: call.status, 
                duration_seconds: call.duration_seconds, 
                billed_minutes: call.billed_minutes, 
                total_charge: call.total_charge, 
                end_reason: call.end_reason 
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const getCallDetails = async (req, res) => {
    const { call_id } = req.params;
    const user_id = req.user.id;

    try {
        const call = store.call_sessions.find(c => c.id === call_id);
        if (!call) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call session not found' } });
        }

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
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    try {
        let userCalls = store.call_sessions.filter(c => c.caller_id === user_id || c.receiver_id === user_id);

        if (role === 'caller') {
            userCalls = userCalls.filter(c => c.caller_id === user_id);
        } else if (role === 'receiver') {
            userCalls = userCalls.filter(c => c.receiver_id === user_id);
        }

        const paginatedCalls = userCalls.sort((a, b) => b.created_at - a.created_at).slice(offset, offset + limitNum);
        
        res.status(200).json({
            success: true,
            data: {
                calls: paginatedCalls,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: userCalls.length
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