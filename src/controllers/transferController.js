const transferService = require('../services/transferService');
const { 
  createTransferSchema, 
  validate 
} = require('../validators/transactionValidator');
const { getAccountsQuerySchema } = require('../validators/accountValidator');

/**
 * Handles atomic money transfer between accounts.
 * POST /api/v1/transfers
 */
async function createTransfer(req, res, next) {
  try {
    const validatedData = validate(createTransferSchema, req.body);
    const result = await transferService.transferMoney(validatedData);

    return res.status(201).json({
      success: true,
      message: 'Money transfer completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles retrieval of transfer history.
 * GET /api/v1/transfers
 */
async function getTransfers(req, res, next) {
  try {
    const validatedQuery = validate(getAccountsQuerySchema, req.query);
    const result = await transferService.getTransfers({
      page: validatedQuery.page,
      limit: validatedQuery.limit
    });

    return res.status(200).json({
      success: true,
      message: 'Transfers retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTransfer,
  getTransfers
};
