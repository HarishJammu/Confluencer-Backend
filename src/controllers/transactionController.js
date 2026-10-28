const transactionService = require('../services/transactionService');
const { 
  createTransactionSchema, 
  getTransactionsQuerySchema, 
  validate 
} = require('../validators/transactionValidator');
const { accountIdParamSchema } = require('../validators/accountValidator');

/**
 * Handles creation of credit or debit transaction.
 * POST /api/v1/transactions
 */
async function createTransaction(req, res, next) {
  try {
    const validatedData = validate(createTransactionSchema, req.body);
    const transaction = await transactionService.createTransaction(validatedData);

    return res.status(201).json({
      success: true,
      message: `${transaction.type.toUpperCase()} transaction executed successfully`,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles retrieval of transaction history for a single account.
 * GET /api/v1/accounts/:id/transactions
 */
async function getAccountTransactions(req, res, next) {
  try {
    const { id: accountId } = validate(accountIdParamSchema, req.params);
    const validatedQuery = validate(getTransactionsQuerySchema, req.query);

    const result = await transactionService.getAccountTransactions(accountId, {
      type: validatedQuery.type,
      page: validatedQuery.page,
      limit: validatedQuery.limit
    });

    return res.status(200).json({
      success: true,
      message: 'Account transaction history retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles retrieval of transactions across all accounts with filters.
 * GET /api/v1/transactions
 */
async function getAllTransactions(req, res, next) {
  try {
    const validatedQuery = validate(getTransactionsQuerySchema, req.query);
    const result = await transactionService.getAllTransactions(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles retrieval of dashboard summary aggregations.
 * GET /api/v1/dashboard/summary
 */
async function getDashboardSummary(req, res, next) {
  try {
    const summary = await transactionService.getDashboardSummary();

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: summary
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTransaction,
  getAccountTransactions,
  getAllTransactions,
  getDashboardSummary
};
