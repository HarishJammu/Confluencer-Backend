const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Transaction endpoints
router.post('/', transactionController.createTransaction);
router.get('/', transactionController.getAllTransactions);

module.exports = router;
