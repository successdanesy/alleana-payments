const express = require('express');
const { getWallet, fundWallet, webhook, getTransactions } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');
const { fundWalletValidation } = require('../utils/validation');

const router = express.Router();

router.get('/', protect, getWallet);
router.post('/fund', protect, fundWalletValidation, fundWallet);
router.post('/webhook', webhook);
router.get('/transactions', protect, getTransactions);

module.exports = router;
