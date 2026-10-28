const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const transactionController = require('../controllers/transactionController');

// Account CRUD & details endpoints
router.post('/', accountController.createAccount);
router.get('/', accountController.getAccounts);
router.get('/:id', accountController.getAccountById);
router.get('/:id/balance', accountController.getAccountBalance);

// Account-specific transactions endpoint
router.get('/:id/transactions', transactionController.getAccountTransactions);

module.exports = router;
