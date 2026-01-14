const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const store = require('../utils/inMemoryStore');

const getWallet = async (req, res) => {
  try {
    const wallet = store.wallets.find(w => w.user_id === req.user.id);

    if (!wallet) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
    }
    
    // Return a subset of fields
    const walletResponse = {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency
    };

    res.status(200).json({ success: true, data: walletResponse });
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
        const wallet = store.wallets.find(w => w.user_id === req.user.id);
        if (!wallet) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        }
        
        const reference = `MON_${uuidv4().split('-').join('')}`;

        const newTransaction = {
            id: uuidv4(),
            wallet_id: wallet.id,
            type: 'deposit',
            amount: parseFloat(amount),
            reference,
            status: 'pending',
            metadata: {},
            created_at: new Date(),
        };
        store.transactions.push(newTransaction);

        res.status(200).json({
        success: true,
        data: {
            transaction_id: newTransaction.id,
            reference: newTransaction.reference,
            amount: newTransaction.amount,
            status: newTransaction.status,
            payment_url: `https://mocked-monnify.com/pay/${reference}`,
        },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
    }
};

const webhook = async (req, res) => {
    const { reference, status } = req.body;
    
    if (status === 'PAID') {
        try {
            const transaction = store.transactions.find(t => t.reference === reference && t.status === 'pending');

            if (!transaction) {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found or already processed' } });
            }

            const wallet = store.wallets.find(w => w.id === transaction.wallet_id);
            if (wallet) {
                wallet.balance = parseFloat(wallet.balance) + parseFloat(transaction.amount);
                wallet.updated_at = new Date();
            }

            transaction.status = 'completed';

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
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    try {
        const wallet = store.wallets.find(w => w.user_id === req.user.id);
        if (!wallet) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        }
        
        let userTransactions = store.transactions.filter(t => t.wallet_id === wallet.id);
        
        if (type) {
            userTransactions = userTransactions.filter(t => t.type === type);
        }

        const paginatedTransactions = userTransactions.sort((a, b) => b.created_at - a.created_at).slice(offset, offset + limitNum);

        res.status(200).json({
            success: true,
            data: {
                transactions: paginatedTransactions.map(t => ({
                    id: t.id,
                    type: t.type,
                    amount: t.amount,
                    status: t.status,
                    reference: t.reference,
                    created_at: t.created_at,
                })),
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: userTransactions.length,
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