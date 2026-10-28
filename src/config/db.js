const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const databaseName = isTest ? (process.env.DB_NAME_TEST || 'transaction_ledger_test') : (process.env.DB_NAME || 'transaction_ledger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  decimalNumbers: false, // Keep DECIMAL values as strings to avoid floating point imprecision
  dateStrings: true
});

/**
 * Verifies active database connection.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    console.error(`Failed to connect to database [${databaseName}]:`, error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection
};
