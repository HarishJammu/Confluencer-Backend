-- Seed Data for Transaction Ledger Management System

-- Clear existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE transactions;
TRUNCATE TABLE transfers;
TRUNCATE TABLE accounts;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert initial accounts (initial balance 0)
INSERT INTO accounts (id, name, balance, created_at) VALUES
(1, 'Operating Treasury Account', 250000.00, NOW() - INTERVAL 10 DAY),
(2, 'Payroll Reserve Account', 85000.00, NOW() - INTERVAL 8 DAY),
(3, 'Vendor Escrow Account', 42000.00, NOW() - INTERVAL 5 DAY),
(4, 'Marketing & Growth Fund', 15500.00, NOW() - INTERVAL 3 DAY),
(5, 'Client Settlement Account', 0.00, NOW() - INTERVAL 1 DAY);

-- Insert ledger records corresponding to account balances
INSERT INTO transactions (id, account_id, type, amount, balance_after, description, reference_id, transfer_id, created_at) VALUES
(1, 1, 'credit', 250000.00, 250000.00, 'Initial capital injection from treasury', 'REF-INIT-TREASURY-01', NULL, NOW() - INTERVAL 10 DAY),
(2, 2, 'credit', 100000.00, 100000.00, 'Monthly payroll budget allocation', 'REF-PAYROLL-ALLOC-01', NULL, NOW() - INTERVAL 8 DAY),
(3, 2, 'debit', 15000.00, 85000.00, 'Contractor compensation payout batch 1', 'REF-PAYOUT-BATCH-01', NULL, NOW() - INTERVAL 7 DAY),
(4, 3, 'credit', 50000.00, 50000.00, 'Vendor retainer deposit', 'REF-VENDOR-DEP-01', NULL, NOW() - INTERVAL 5 DAY),
(5, 3, 'debit', 8000.00, 42000.00, 'Cloud infrastructure retainer payment', 'REF-CLOUD-HOSTING-01', NULL, NOW() - INTERVAL 4 DAY),
(6, 4, 'credit', 20000.00, 20000.00, 'Q4 Ad campaign budget deposit', 'REF-MKTG-Q4-01', NULL, NOW() - INTERVAL 3 DAY),
(7, 4, 'debit', 4500.00, 15500.00, 'Search advertising platform billing', 'REF-ADWORDS-BILL-01', NULL, NOW() - INTERVAL 2 DAY);
