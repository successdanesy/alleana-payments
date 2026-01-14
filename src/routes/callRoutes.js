const express = require('express');
const { 
    initiateCall, 
    answerCall, 
    endCall, 
    getCallDetails, 
    getCallHistory 
} = require('../controllers/callController');
const { protect } = require('../middleware/authMiddleware');
const { initiateCallValidation, endCallValidation } = require('../utils/validation');

const router = express.Router();

router.post('/initiate', protect, initiateCallValidation, initiateCall);
router.patch('/:call_id/answer', protect, answerCall);
router.patch('/:call_id/end', protect, endCallValidation, endCall);
router.get('/history', protect, getCallHistory);
router.get('/:call_id', protect, getCallDetails);

module.exports = router;
