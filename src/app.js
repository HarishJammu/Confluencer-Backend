const express = require('express');
const cors = require('cors');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const transferRoutes = require('./routes/transferRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request bodies
app.use(express.json({ limit: '1mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API v1 Route Mounts
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
