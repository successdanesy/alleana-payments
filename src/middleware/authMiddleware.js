const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../utils/db');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);

      const result = await db.query('SELECT id, email, full_name FROM users WHERE id = $1', [decoded.sub]);
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized, user not found' } });
      }

      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized, token failed' } });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized, no token' } });
  }
};

module.exports = { protect };
