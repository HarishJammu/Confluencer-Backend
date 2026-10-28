const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

// Money transfer endpoints
router.post('/', transferController.createTransfer);
router.get('/', transferController.getTransfers);

module.exports = router;
