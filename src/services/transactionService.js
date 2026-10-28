const { pool } = require('../config/db');
const { 
  NotFoundError, 
  ConflictError, 
  BusinessRuleError 
} = require('../middleware/errorHandler');
const { 
  addMoney, 
  subtractMoney, 
  isGreaterOrEqual, 
  toDecimalString,
  toMinorUnits 
} = require('../utils/money');

/**
 * Creates a financial transaction (credit or debit) atomically.
 * Uses SELECT ... FOR UPDATE to lock the account row and prevent race conditions.
 * Enforces duplicate reference check per account and non-negative balance on debit.
 * 
 * @param {object} params
 * @param {number} params.account_id
 * @param {'credit'|'debit'} params.type
 * @param {string|number} params.amount
 * @param {string} [params.description]
 * @param {string} params.reference_id
 * @returns {Promise<object>} Created transaction with updated account balance
 */
async function createTransaction({ account_id, type, amount, description, reference_id }) {
  const formattedAmount = toDecimalString(toMinorUnits(amount));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock account row with FOR UPDATE
    const [accountRows] = await connection.execute(
      'SELECT id, name, balance FROM accounts WHERE id = ? FOR UPDATE',
      [account_id]
    );

    if (accountRows.length === 0) {
      await connection.rollback();
      throw new NotFoundError(`Account with ID ${account_id} was not found`, 'ACCOUNT_NOT_FOUND');
    }

    const account = accountRows[0];
    const currentBalance = account.balance;

    // 2. Check for duplicate reference_id for this account
    const [existingTx] = await connection.execute(
      'SELECT id FROM transactions WHERE account_id = ? AND reference_id = ?',
      [account_id, reference_id.trim()]
    );

    if (existingTx.length > 0) {
      await connection.rollback();
      throw new ConflictError(
        `Transaction with reference ID "${reference_id}" already exists for account #${account_id}`,
        'DUPLICATE_REFERENCE'
      );
    }

    // 3. For debit, verify sufficient balance using exact math
    if (type === 'debit') {
      if (!isGreaterOrEqual(currentBalance, formattedAmount)) {
        await connection.rollback();
        throw new BusinessRuleError(
          `Insufficient account balance. Available: ${currentBalance}, Requested Debit: ${formattedAmount}`,
          'INSUFFICIENT_BALANCE',
          400
        );
      }
    }

    // 4. Calculate new balance
    const newBalance = type === 'credit'
      ? addMoney(currentBalance, formattedAmount)
      : subtractMoney(currentBalance, formattedAmount);

    // 5. Insert transaction record
    const [txResult] = await connection.execute(
      `INSERT INTO transactions 
        (account_id, type, amount, balance_after, description, reference_id, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        account_id,
        type,
        formattedAmount,
        newBalance,
        description ? description.trim() : null,
        reference_id.trim()
      ]
    );

    // 6. Update account balance
    await connection.execute(
      'UPDATE accounts SET balance = ? WHERE id = ?',
      [newBalance, account_id]
    );

    // 7. Commit database transaction
    await connection.commit();

    return {
      id: txResult.insertId,
      account_id,
      account_name: account.name,
      type,
      amount: formattedAmount,
      balance_after: newBalance,
      description: description ? description.trim() : null,
      reference_id: reference_id.trim()
    };
  } catch (error) {
    await connection.rollback();

    // Catch MySQL composite unique constraint violation: (account_id, reference_id)
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      throw new ConflictError(
        `Transaction with reference ID "${reference_id}" already exists for account #${account_id}`,
        'DUPLICATE_REFERENCE'
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Retrieves paginated transactions for a specific account.
 * 
 * @param {number} accountId 
 * @param {object} params { type, page, limit }
 * @returns {Promise<object>}
 */
async function getAccountTransactions(accountId, { type, page = 1, limit = 10 }) {
  // Verify account exists first
  const [accountRows] = await pool.execute(
    'SELECT id, name, balance FROM accounts WHERE id = ?',
    [accountId]
  );

  if (accountRows.length === 0) {
    throw new NotFoundError(`Account with ID ${accountId} was not found`, 'ACCOUNT_NOT_FOUND');
  }

  const offset = (page - 1) * limit;
  let countSql = 'SELECT COUNT(*) AS total FROM transactions WHERE account_id = ?';
  let querySql = `SELECT id, account_id, type, amount, balance_after, description, reference_id, transfer_id, created_at 
                  FROM transactions WHERE account_id = ?`;
  const countParams = [accountId];
  const queryParams = [accountId];

  if (type) {
    countSql += ' AND type = ?';
    querySql += ' AND type = ?';
    countParams.push(type);
    queryParams.push(type);
  }

  querySql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const [[{ total }]] = await pool.query(countSql, countParams);
  const [transactions] = await pool.query(querySql, queryParams);

  const totalPages = Math.ceil(total / limit) || 0;

  return {
    account: accountRows[0],
    transactions,
    pagination: {
      total: Number(total),
      page: Number(page),
      limit: Number(limit),
      totalPages
    }
  };
}

/**
 * Retrieves transactions across all accounts with filters and pagination.
 * 
 * @param {object} params { account_id, type, page, limit, search }
 * @returns {Promise<object>}
 */
async function getAllTransactions({ account_id, type, page = 1, limit = 10, search = '' }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const queryParams = [];
  const countParams = [];

  if (account_id) {
    whereClauses.push('t.account_id = ?');
    queryParams.push(account_id);
    countParams.push(account_id);
  }

  if (type) {
    whereClauses.push('t.type = ?');
    queryParams.push(type);
    countParams.push(type);
  }

  const trimmedSearch = (search || '').trim();
  if (trimmedSearch) {
    whereClauses.push('(t.reference_id LIKE ? OR t.description LIKE ? OR a.name LIKE ?)');
    const searchTerm = `%${trimmedSearch}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total 
                    FROM transactions t 
                    JOIN accounts a ON t.account_id = a.id 
                    ${whereString}`;

  let querySql = `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, 
                         t.balance_after, t.description, t.reference_id, t.transfer_id, t.created_at
                  FROM transactions t
                  JOIN accounts a ON t.account_id = a.id
                  ${whereString}
                  ORDER BY t.created_at DESC, t.id DESC
                  LIMIT ? OFFSET ?`;

  queryParams.push(limit, offset);

  const [[{ total }]] = await pool.query(countSql, countParams);
  const [transactions] = await pool.query(querySql, queryParams);

  const totalPages = Math.ceil(total / limit) || 0;

  return {
    transactions,
    pagination: {
      total: Number(total),
      page: Number(page),
      limit: Number(limit),
      totalPages
    }
  };
}

/**
 * Retrieves aggregated dashboard metrics from the database.
 * 
 * @returns {Promise<object>}
 */
async function getDashboardSummary() {
  const [[accountStats]] = await pool.query(
    'SELECT COUNT(*) AS total_accounts, COALESCE(SUM(balance), 0.00) AS total_balance FROM accounts'
  );

  const [[txStats]] = await pool.query(
    `SELECT 
      COUNT(*) AS total_transactions,
      SUM(CASE WHEN type = 'credit' THEN 1 ELSE 0 END) AS total_credits,
      SUM(CASE WHEN type = 'debit' THEN 1 ELSE 0 END) AS total_debits,
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0.00 END), 0.00) AS total_credit_amount,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0.00 END), 0.00) AS total_debit_amount
     FROM transactions`
  );

  const [recentTransactions] = await pool.query(
    `SELECT t.id, t.account_id, a.name AS account_name, t.type, t.amount, 
            t.balance_after, t.description, t.reference_id, t.created_at
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 5`
  );

  return {
    totalAccounts: Number(accountStats.total_accounts),
    totalBalance: accountStats.total_balance,
    totalTransactions: Number(txStats.total_transactions),
    totalCredits: Number(txStats.total_credits || 0),
    totalDebits: Number(txStats.total_debits || 0),
    totalCreditAmount: txStats.total_credit_amount,
    totalDebitAmount: txStats.total_debit_amount,
    recentTransactions
  };
}

module.exports = {
  createTransaction,
  getAccountTransactions,
  getAllTransactions,
  getDashboardSummary
};
