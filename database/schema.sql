-- Transaction Ledger Management System Schema
-- MySQL 8 with InnoDB Engine

-- Drop existing tables if needed (in reverse foreign key dependency order)
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS accounts;

-- 1. Accounts Table
CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_balance_non_negative CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Transfers Table
CREATE TABLE transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_account_id INT NOT NULL,
    to_account_id INT NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    reference_id VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transfer_from FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transfer_to FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT chk_transfer_diff_accounts CHECK (from_account_id != to_account_id),
    CONSTRAINT chk_transfer_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Transactions Table (Immutable Financial Ledger Entries)
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    balance_after DECIMAL(18, 2) NOT NULL,
    description VARCHAR(255) NULL,
    reference_id VARCHAR(100) NOT NULL,
    transfer_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tx_transfer FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE RESTRICT,
    CONSTRAINT uq_account_reference UNIQUE (account_id, reference_id),
    INDEX idx_account_created (account_id, created_at, id),
    INDEX idx_tx_type (type),
    INDEX idx_tx_created (created_at),
    CONSTRAINT chk_tx_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
