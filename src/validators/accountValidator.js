const Joi = require('joi');
const { ValidationError } = require('../middleware/errorHandler');

const createAccountSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.empty': 'Account name is required',
    'string.min': 'Account name must be at least 2 characters long',
    'string.max': 'Account name cannot exceed 255 characters',
    'any.required': 'Account name is required'
  })
}).options({ stripUnknown: false, abortEarly: false });

const getAccountsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow('', null).optional()
}).options({ stripUnknown: true });

const accountIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'Account ID must be a valid number',
    'number.positive': 'Account ID must be a positive integer',
    'any.required': 'Account ID is required'
  })
});

/**
 * Validates request payload against schema and formats error messages.
 */
function validate(schema, data) {
  const { error, value } = schema.validate(data);
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    throw new ValidationError(errorMessages[0], errorMessages);
  }
  return value;
}

module.exports = {
  createAccountSchema,
  getAccountsQuerySchema,
  accountIdParamSchema,
  validate
};
