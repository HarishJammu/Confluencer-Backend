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
 * Executes an atomic fund transfer between two distinct accounts.
 * Locks both account rows in ascending ID order to prevent deadlocks under concurrency.
 * Enforces transfer-level idempotency and writes immutable dual ledger entries.
 * 
 * @param {object} params
 * @param {number} params.from_account_id
 * @param {number} params.to_account_id
 * @param {string|number} params.amount
 * @param {string} params.reference_id
 * @param {string} [params.description]
 * @returns {Promise<object>} Transfer result with updated balances
 */
async function transferMoney({ from_account_id, to_account_id, amount, reference_id, description }) {
  if (from_account_id === to_account_id) {
    throw new BusinessRuleError('Source and destination cannot be the same account', 'INVALID_TRANSFER_ACCOUNTS');
  }

  const formattedAmount = toDecimalString(toMinorUnits(amount));
  const cleanRef = reference_id.trim();
  const cleanDesc = description ? description.trim() : null;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Idempotency Check: Verify transfer reference does not already exist
    const [existingTransfer] = await connection.execute(
      'SELECT id FROM transfers WHERE reference_id = ?',
      [cleanRef]
    );

    if (existingTransfer.length > 0) {
      await connection.rollback();
      throw new ConflictError(
        `A transfer with reference ID "${cleanRef}" has already been processed`,
        'DUPLICATE_TRANSFER_REFERENCE'
      );
    }

    // 2. Deterministic ID Locking: Lock accounts in ascending ID order to prevent deadlocks
    const [firstId, secondId] = from_account_id < to_account_id
      ? [from_account_id, to_account_id]
      : [to_account_id, from_account_id];

    const [lockedAccounts] = await connection.execute(
      'SELECT id, name, balance FROM accounts WHERE id IN (?, ?) ORDER BY id ASC FOR UPDATE',
      [firstId, secondId]
    );

    if (lockedAccounts.length < 2) {
      await connection.rollback();
      const foundIds = lockedAccounts.map((a) => a.id);
      const missingId = !foundIds.includes(from_account_id) ? from_account_id : to_account_id;
      throw new NotFoundError(`Account with ID ${missingId} was not found`, 'ACCOUNT_NOT_FOUND');
    }

    const fromAccount = lockedAccounts.find((a) => a.id === from_account_id);
    const toAccount = lockedAccounts.find((a) => a.id === to_account_id);

    // 3. Balance Validation on Source Account
    if (!isGreaterOrEqual(fromAccount.balance, formattedAmount)) {
      await connection.rollback();
      throw new BusinessRuleError(
        `Insufficient balance for transfer. Available: ${fromAccount.balance}, Requested: ${formattedAmount}`,
        'INSUFFICIENT_BALANCE',
        400
      );
    }

    // 4. Compute New Balances using exact decimal arithmetic
    const newFromBalance = subtractMoney(fromAccount.balance, formattedAmount);
    const newToBalance = addMoney(toAccount.balance, formattedAmount);

    // 5. Insert Transfer Record
    const [transferResult] = await connection.execute(
      `INSERT INTO transfers 
        (from_account_id, to_account_id, amount, reference_id, description, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [from_account_id, to_account_id, formattedAmount, cleanRef, cleanDesc]
    );

    const transferId = transferResult.insertId;

    // 6. Insert Debit Transaction for Source Account
    const debitRef = `${cleanRef}-DEBIT`;
    const debitDesc = cleanDesc 
      ? `Transfer to ${toAccount.name} (#${to_account_id}): ${cleanDesc}`
      : `Transfer to ${toAccount.name} (#${to_account_id})`;

    await connection.execute(
      `INSERT INTO transactions 
        (account_id, type, amount, balance_after, description, reference_id, transfer_id, created_at)
       VALUES (?, 'debit', ?, ?, ?, ?, ?, NOW())`,
      [from_account_id, formattedAmount, newFromBalance, debitDesc, debitRef, transferId]
    );

    // 7. Insert Credit Transaction for Destination Account
    const creditRef = `${cleanRef}-CREDIT`;
    const creditDesc = cleanDesc
      ? `Transfer from ${fromAccount.name} (#${from_account_id}): ${cleanDesc}`
      : `Transfer from ${fromAccount.name} (#${from_account_id})`;

    await connection.execute(
      `INSERT INTO transactions 
        (account_id, type, amount, balance_after, description, reference_id, transfer_id, created_at)
       VALUES (?, 'credit', ?, ?, ?, ?, ?, NOW())`,
      [to_account_id, formattedAmount, newToBalance, creditDesc, creditRef, transferId]
    );

    // 8. Update Balances on Both Accounts
    await connection.execute(
      'UPDATE accounts SET balance = ? WHERE id = ?',
      [newFromBalance, from_account_id]
    );

    await connection.execute(
      'UPDATE accounts SET balance = ? WHERE id = ?',
      [newToBalance, to_account_id]
    );

    // 9. Commit Transaction
    await connection.commit();

    return {
      transfer_id: transferId,
      reference_id: cleanRef,
      amount: formattedAmount,
      description: cleanDesc,
      from_account: {
        id: from_account_id,
        name: fromAccount.name,
        new_balance: newFromBalance
      },
      to_account: {
        id: to_account_id,
        name: toAccount.name,
        new_balance: newToBalance
      }
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      throw new ConflictError(
        `A transfer with reference ID "${cleanRef}" has already been processed`,
        'DUPLICATE_TRANSFER_REFERENCE'
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Retrieves paginated transfer history.
 * 
 * @param {object} params { page, limit }
 * @returns {Promise<object>}
 */
async function getTransfers({ page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;

  const countSql = 'SELECT COUNT(*) AS total FROM transfers';
  const querySql = `
    SELECT 
      t.id, 
      t.from_account_id, 
      fa.name AS from_account_name,
      t.to_account_id, 
      ta.name AS to_account_name,
      t.amount, 
      t.reference_id, 
      t.description, 
      t.created_at
    FROM transfers t
    JOIN accounts fa ON t.from_account_id = fa.id
    JOIN accounts ta ON t.to_account_id = ta.id
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ? OFFSET ?
  `;

  const [[{ total }]] = await pool.query(countSql);
  const [transfers] = await pool.query(querySql, [limit, offset]);

  const totalPages = Math.ceil(total / limit) || 0;

  return {
    transfers,
    pagination: {
      total: Number(total),
      page: Number(page),
      limit: Number(limit),
      totalPages
    }
  };
}

module.exports = {
  transferMoney,
  getTransfers
};
