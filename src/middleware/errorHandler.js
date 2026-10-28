/**
 * Custom Application Error Classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = null) {
    super(message, 400, 'VALIDATION_ERROR', errors);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

class BusinessRuleError extends AppError {
  constructor(message, code = 'BUSINESS_RULE_VIOLATION', statusCode = 400) {
    super(message, statusCode, code);
  }
}

/**
 * Global Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  // Operational AppError instances
  if (err instanceof AppError) {
    const response = {
      success: false,
      message: err.message,
      code: err.code
    };
    if (err.errors) {
      response.errors = err.errors;
    }
    return res.status(err.statusCode).json(response);
  }

  // MySQL Duplicate Key Error (Race conditions / constraint violations)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return res.status(409).json({
      success: false,
      message: 'A duplicate record with this unique reference already exists',
      code: 'DUPLICATE_ENTRY'
    });
  }

  // MySQL Check Constraint Violation (e.g. negative balance)
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.errno === 3819) {
    return res.status(400).json({
      success: false,
      message: 'Operation violates financial constraint or balance requirement',
      code: 'CONSTRAINT_VIOLATION'
    });
  }

  // Unhandled / Unexpected Server Errors (never leak SQL or stack traces)
  console.error('[Unhandled Server Error]:', err);
  return res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR'
  });
}

/**
 * 404 Route Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND'
  });
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  errorHandler,
  notFoundHandler
};
