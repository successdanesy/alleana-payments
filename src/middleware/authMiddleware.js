const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../utils/inMemoryStore');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);

      const user = store.users.find(u => u.id === decoded.sub);
      
      if (!user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized, user not found' } });
      }

      // Attach a clean user object, without the password hash
      req.user = {
          id: user.id,
          email: user.email,
          full_name: user.full_name
      };
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