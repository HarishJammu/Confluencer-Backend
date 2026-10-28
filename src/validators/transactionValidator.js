const Joi = require('joi');
const { ValidationError } = require('../middleware/errorHandler');

// Money amount validator: positive number or numeric string with at most 2 decimal places
const amountCustomValidator = (value, helpers) => {
  const strVal = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(strVal)) {
    return helpers.message('Amount must be a positive number with at most 2 decimal places');
  }
  const num = parseFloat(strVal);
  if (isNaN(num) || num <= 0) {
    return helpers.message('Amount must be greater than zero');
  }
  return strVal;
};

const createTransactionSchema = Joi.object({
  account_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Account ID must be a valid number',
    'number.positive': 'Account ID must be a positive integer',
    'any.required': 'Account ID is required'
  }),
  type: Joi.string().trim().lowercase().valid('credit', 'debit').required().messages({
    'any.only': 'Transaction type must be either "credit" or "debit"',
    'any.required': 'Transaction type is required'
  }),
  amount: Joi.any().custom(amountCustomValidator).required().messages({
    'any.required': 'Transaction amount is required'
  }),
  reference_id: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Reference ID is required',
    'string.max': 'Reference ID cannot exceed 100 characters',
    'any.required': 'Reference ID is required'
  }),
  description: Joi.string().trim().max(255).allow('', null).optional()
}).options({ stripUnknown: false });

const getTransactionsQuerySchema = Joi.object({
  account_id: Joi.number().integer().positive().optional(),
  type: Joi.string().trim().lowercase().valid('credit', 'debit').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow('', null).optional()
}).options({ stripUnknown: true });

const createTransferSchema = Joi.object({
  from_account_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Source account ID must be a valid number',
    'any.required': 'Source account ID is required'
  }),
  to_account_id: Joi.number().integer().positive().disallow(Joi.ref('from_account_id')).required().messages({
    'number.base': 'Destination account ID must be a valid number',
    'any.invalid': 'Source and destination cannot be the same account',
    'any.required': 'Destination account ID is required'
  }),
  amount: Joi.any().custom(amountCustomValidator).required().messages({
    'any.required': 'Transfer amount is required'
  }),
  reference_id: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Transfer reference ID is required',
    'string.max': 'Transfer reference ID cannot exceed 100 characters',
    'any.required': 'Transfer reference ID is required'
  }),
  description: Joi.string().trim().max(255).allow('', null).optional()
}).options({ stripUnknown: false });

function validate(schema, data) {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    throw new ValidationError(errorMessages[0], errorMessages);
  }
  return value;
}

module.exports = {
  createTransactionSchema,
  getTransactionsQuerySchema,
  createTransferSchema,
  validate
};
