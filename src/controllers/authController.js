const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const store = require('../utils/inMemoryStore');
const config = require('../config');

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: errors.array() } });
  }

  const { email, password, full_name } = req.body;

  try {
    const userExists = store.users.find(u => u.email === email);
    if (userExists) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'User with this email already exists' } });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(),
      email,
      password_hash,
      full_name,
      created_at: new Date(),
      updated_at: new Date(),
    };
    store.users.push(newUser);

    // Create a wallet for the new user
    const newWallet = {
      id: uuidv4(),
      user_id: newUser.id,
      balance: 0.00,
      currency: 'NGN',
      created_at: new Date(),
      updated_at: new Date(),
    };
    store.wallets.push(newWallet);
    
    const userForToken = { id: newUser.id, email: newUser.email, full_name: newUser.full_name };
    const token = jwt.sign({ sub: userForToken.id, email: userForToken.email }, config.jwtSecret, { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      data: {
        user: userForToken,
        token,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: errors.array() } });
  }

  const { email, password } = req.body;

  try {
    const user = store.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }
    
    const userForResponse = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
    };

    const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '24h' });

    res.status(200).json({
      success: true,
      data: {
        user: userForResponse,
        token,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
};

module.exports = {
  register,
  login,
};