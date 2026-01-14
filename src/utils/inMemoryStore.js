const { v4: uuidv4 } = require('uuid');

// In-memory data stores
const users = [];
const wallets = [];
const transactions = [];
const call_sessions = [];

module.exports = {
  users,
  wallets,
  transactions,
  call_sessions,
};
