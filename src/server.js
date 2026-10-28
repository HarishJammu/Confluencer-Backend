const app = require('./app');
const { testConnection, pool } = require('./config/db');

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  try {
    // Verify database connectivity prior to accepting traffic
    await testConnection();
    console.log('✓ Successfully connected to MySQL database');

    const server = app.listen(PORT, () => {
      console.log(`✓ Transaction Ledger API running on http://localhost:${PORT}`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await pool.end();
          console.log('✓ Database connection pool closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing database pool:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
