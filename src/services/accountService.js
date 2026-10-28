const { pool } = require('../config/db');
const { NotFoundError } = require('../middleware/errorHandler');

/**
 * Creates a new account with a guaranteed initial balance of 0.00.
 * 
 * @param {string} name - Account holder name
 * @returns {Promise<object>} Created account details
 */
async function createAccount(name) {
  const [result] = await pool.execute(
    'INSERT INTO accounts (name, balance) VALUES (?, 0.00)',
    [name.trim()]
  );

  const [rows] = await pool.execute(
    'SELECT id, name, balance, created_at FROM accounts WHERE id = ?',
    [result.insertId]
  );

  return rows[0];
}

/**
 * Retrieves paginated list of accounts with optional search.
 * 
 * @param {object} params - Query filters { page, limit, search }
 * @returns {Promise<object>} Accounts list and pagination metadata
 */
async function getAccounts({ page = 1, limit = 10, search = '' }) {
  const offset = (page - 1) * limit;
  let countSql = 'SELECT COUNT(*) AS total FROM accounts';
  let querySql = 'SELECT id, name, balance, created_at FROM accounts';
  const queryParams = [];
  const countParams = [];

  const trimmedSearch = (search || '').trim();
  if (trimmedSearch) {
    const isNumeric = /^\d+$/.test(trimmedSearch);
    if (isNumeric) {
      countSql += ' WHERE id = ? OR name LIKE ?';
      querySql += ' WHERE id = ? OR name LIKE ?';
      countParams.push(parseInt(trimmedSearch, 10), `%${trimmedSearch}%`);
      queryParams.push(parseInt(trimmedSearch, 10), `%${trimmedSearch}%`);
    } else {
      countSql += ' WHERE name LIKE ?';
      querySql += ' WHERE name LIKE ?';
      countParams.push(`%${trimmedSearch}%`);
      queryParams.push(`%${trimmedSearch}%`);
    }
  }

  // Order by latest created first with deterministic ID tiebreaker
  querySql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  // Execute both queries using pool
  const [[{ total }]] = await pool.query(countSql, countParams);
  const [accounts] = await pool.query(querySql, queryParams);

  const totalPages = Math.ceil(total / limit) || 0;

  return {
    accounts,
    pagination: {
      total: Number(total),
      page: Number(page),
      limit: Number(limit),
      totalPages
    }
  };
}

/**
 * Retrieves a single account by ID.
 * 
 * @param {number} id - Account ID
 * @returns {Promise<object>} Account details
 */
async function getAccountById(id) {
  const [rows] = await pool.execute(
    'SELECT id, name, balance, created_at FROM accounts WHERE id = ?',
    [id]
  );

  if (rows.length === 0) {
    throw new NotFoundError(`Account with ID ${id} was not found`, 'ACCOUNT_NOT_FOUND');
  }

  return rows[0];
}

/**
 * Retrieves current balance for a specific account.
 * 
 * @param {number} id - Account ID
 * @returns {Promise<object>} { account_id, balance }
 */
async function getAccountBalance(id) {
  const [rows] = await pool.execute(
    'SELECT id, balance FROM accounts WHERE id = ?',
    [id]
  );

  if (rows.length === 0) {
    throw new NotFoundError(`Account with ID ${id} was not found`, 'ACCOUNT_NOT_FOUND');
  }

  return {
    account_id: rows[0].id,
    balance: rows[0].balance
  };
}

module.exports = {
  createAccount,
  getAccounts,
  getAccountById,
  getAccountBalance
};
