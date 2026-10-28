const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Dashboard summary metrics
router.get('/summary', transactionController.getDashboardSummary);

module.exports = router;
