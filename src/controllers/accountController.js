const accountService = require('../services/accountService');
const { 
  createAccountSchema, 
  getAccountsQuerySchema, 
  accountIdParamSchema, 
  validate 
} = require('../validators/accountValidator');

/**
 * Handles account creation.
 * POST /api/v1/accounts
 */
async function createAccount(req, res, next) {
  try {
    const validatedData = validate(createAccountSchema, req.body);
    const newAccount = await accountService.createAccount(validatedData.name);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: newAccount
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles paginated account list retrieval with search.
 * GET /api/v1/accounts
 */
async function getAccounts(req, res, next) {
  try {
    const validatedQuery = validate(getAccountsQuerySchema, req.query);
    const result = await accountService.getAccounts(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles single account retrieval by ID.
 * GET /api/v1/accounts/:id
 */
async function getAccountById(req, res, next) {
  try {
    const { id } = validate(accountIdParamSchema, req.params);
    const account = await accountService.getAccountById(id);

    return res.status(200).json({
      success: true,
      message: 'Account details retrieved successfully',
      data: account
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles account balance retrieval by ID.
 * GET /api/v1/accounts/:id/balance
 */
async function getAccountBalance(req, res, next) {
  try {
    const { id } = validate(accountIdParamSchema, req.params);
    const balanceData = await accountService.getAccountBalance(id);

    return res.status(200).json({
      success: true,
      message: 'Account balance retrieved successfully',
      data: balanceData
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAccount,
  getAccounts,
  getAccountById,
  getAccountBalance
};
