const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

const getWallet = async (req, res) => {
  try {
    const wallet = await db.query('SELECT id, balance, currency FROM wallets WHERE user_id = $1', [req.user.id]);

    if (wallet.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
    }

    res.status(200).json({ success: true, data: wallet.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
};

const fundWallet = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: errors.array() } });
    }
  
    const { amount } = req.body;
  
    try {
        const walletResult = await db.query('SELECT id FROM wallets WHERE user_id = $1', [req.user.id]);
        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        }
        const wallet_id = walletResult.rows[0].id;

        const reference = `MON_${uuidv4()}`;

        const transaction = await db.query(
        'INSERT INTO transactions (wallet_id, type, amount, reference, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, reference, amount, status',
        [wallet_id, 'deposit', amount, reference, 'pending']
        );

        res.status(200).json({
        success: true,
        data: {
            transaction_id: transaction.rows[0].id,
            reference: transaction.rows[0].reference,
            amount: transaction.rows[0].amount,
            status: transaction.rows[0].status,
            payment_url: `https://mocked-monnify.com/pay/${reference}`,
        },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const webhook = async (req, res) => {
    const { reference, status, amount, signature } = req.body;

    // In a real application, you would verify the signature from Monnify
    // For this mock, we'll just trust the payload
    
    if (status === 'PAID') {
        try {
            const transactionResult = await db.query('SELECT id, wallet_id, amount FROM transactions WHERE reference = $1 AND status = $2', [reference, 'pending']);
            if (transactionResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found or already processed' } });
            }

            const transaction = transactionResult.rows[0];

            // In a real scenario, you'd also verify the amount matches
            
            await db.query('UPDATE transactions SET status = $1 WHERE id = $2', ['completed', transaction.id]);
            await db.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [transaction.amount, transaction.wallet_id]);

            return res.status(200).json({ success: true, message: 'Payment confirmed' });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error during webhook processing' } });
        }
    }

    res.status(200).json({ success: true, message: 'Webhook received' });
};

const getTransactions = async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    try {
        const walletResult = await db.query('SELECT id FROM wallets WHERE user_id = $1', [req.user.id]);
        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        }
        const wallet_id = walletResult.rows[0].id;
        
        let query = 'SELECT id, type, amount, status, reference, created_at FROM transactions WHERE wallet_id = $1';
        const queryParams = [wallet_id];
        
        if (type) {
            query += ` AND type = $${queryParams.length + 1}`;
            queryParams.push(type);
        }

        const totalResult = await db.query(`SELECT COUNT(*) FROM (${query}) as sub`, queryParams);
        const total = parseInt(totalResult.rows[0].count, 10);
        
        query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, offset);

        const transactionsResult = await db.query(query, queryParams);

        res.status(200).json({
            success: true,
            data: {
                transactions: transactionsResult.rows,
                pagination: {
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    total,
                }
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

module.exports = {
  getWallet,
  fundWallet,
  webhook,
  getTransactions,
};
