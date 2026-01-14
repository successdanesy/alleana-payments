const { body } = require('express-validator');

const registerValidation = [
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('full_name').not().isEmpty().withMessage('Full name is required'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').not().isEmpty().withMessage('Password is required'),
];

const fundWalletValidation = [
    body('amount').isDecimal({ decimal_digits: '1,2' }).withMessage('Amount must be a decimal with up to 2 decimal places').toFloat(),
];

const endCallValidation = [
    body('reason').not().isEmpty().withMessage('Reason for ending the call is required'),
];

const initiateCallValidation = [
    body('receiver_id').isUUID().withMessage('Invalid receiver ID'),
];


module.exports = {
  registerValidation,
  loginValidation,
  fundWalletValidation,
  endCallValidation,
  initiateCallValidation,
};
