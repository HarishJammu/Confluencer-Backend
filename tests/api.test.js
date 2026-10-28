process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

describe('Transaction Ledger API Integration Tests', () => {
  // Helper to reset test database between test suites
  async function cleanDatabase() {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('TRUNCATE TABLE transactions');
    await pool.query('TRUNCATE TABLE transfers');
    await pool.query('TRUNCATE TABLE accounts');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await pool.end();
  });

  // 1. Account creation starts with zero balance
  test('1. Account creation starts with zero balance', async () => {
    const res = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Alpha Corporate Fund' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Alpha Corporate Fund');
    expect(res.body.data.balance).toBe('0.00');
  });

  // 2. Missing account name is rejected
  test('2. Missing account name is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/accounts')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // 3. Successful credit increases balance
  test('3. Successful credit increases balance', async () => {
    const accountRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Credit Test Account' });
    const accountId = accountRes.body.data.id;

    const creditRes = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'credit',
        amount: '150.50',
        description: 'First deposit',
        reference_id: 'REF-CREDIT-01'
      });

    expect(creditRes.status).toBe(201);
    expect(creditRes.body.success).toBe(true);
    expect(creditRes.body.data.balance_after).toBe('150.50');

    // Verify account balance retrieval
    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.data.balance).toBe('150.50');
  });

  // 4. Successful debit decreases balance
  test('4. Successful debit decreases balance', async () => {
    const accountRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Debit Test Account' });
    const accountId = accountRes.body.data.id;

    // Credit 200.00 first
    await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'credit',
        amount: '200.00',
        reference_id: 'REF-SEED-200'
      });

    // Debit 75.25
    const debitRes = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'debit',
        amount: '75.25',
        description: 'Utility payment',
        reference_id: 'REF-DEBIT-01'
      });

    expect(debitRes.status).toBe(201);
    expect(debitRes.body.success).toBe(true);
    expect(debitRes.body.data.balance_after).toBe('124.75');

    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balanceRes.body.data.balance).toBe('124.75');
  });

  // 5. Debit with insufficient funds is rejected
  test('5. Debit with insufficient funds is rejected', async () => {
    const accountRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Low Balance Account' });
    const accountId = accountRes.body.data.id;

    // Credit 50.00
    await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'credit',
        amount: '50.00',
        reference_id: 'REF-SEED-50'
      });

    // Attempt to debit 100.00
    const overRes = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'debit',
        amount: '100.00',
        reference_id: 'REF-OVERDRAFT'
      });

    expect(overRes.status).toBe(400);
    expect(overRes.body.success).toBe(false);
    expect(overRes.body.code).toBe('INSUFFICIENT_BALANCE');

    // Balance remains 50.00
    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balanceRes.body.data.balance).toBe('50.00');
  });

  // 6. Invalid transaction type is rejected
  test('6. Invalid transaction type is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: 1,
        type: 'withdrawal', // Invalid type
        amount: '10.00',
        reference_id: 'REF-INVALID-TYPE'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // 7. Zero or negative amount is rejected
  test('7. Zero or negative amount is rejected', async () => {
    const resZero = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: 1,
        type: 'credit',
        amount: '0.00',
        reference_id: 'REF-ZERO'
      });
    expect(resZero.status).toBe(400);
    expect(resZero.body.code).toBe('VALIDATION_ERROR');

    const resNegative = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: 1,
        type: 'credit',
        amount: '-50.00',
        reference_id: 'REF-NEG'
      });
    expect(resNegative.status).toBe(400);
    expect(resNegative.body.code).toBe('VALIDATION_ERROR');
  });

  // 8. Duplicate reference ID for the same account is rejected without changing the balance
  test('8. Duplicate reference ID for the same account is rejected without changing the balance', async () => {
    const accountRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Dup Ref Account' });
    const accountId = accountRes.body.data.id;

    // First credit
    const firstRes = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'credit',
        amount: '100.00',
        reference_id: 'REF-DUP-CHECK'
      });
    expect(firstRes.status).toBe(201);
    expect(firstRes.body.data.balance_after).toBe('100.00');

    // Second credit with identical reference_id for same account
    const dupRes = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: accountId,
        type: 'credit',
        amount: '100.00',
        reference_id: 'REF-DUP-CHECK'
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.success).toBe(false);
    expect(dupRes.body.code).toBe('DUPLICATE_REFERENCE');

    // Balance remains 100.00, not 200.00
    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balanceRes.body.data.balance).toBe('100.00');
  });

  // 9. Same reference ID works on different accounts
  test('9. Same reference ID works on different accounts', async () => {
    const acc1 = await request(app).post('/api/v1/accounts').send({ name: 'Acc One' });
    const acc2 = await request(app).post('/api/v1/accounts').send({ name: 'Acc Two' });

    const sharedRef = 'REF-SHARED-REF-100';

    const tx1 = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: acc1.body.data.id,
        type: 'credit',
        amount: '50.00',
        reference_id: sharedRef
      });
    expect(tx1.status).toBe(201);

    const tx2 = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: acc2.body.data.id,
        type: 'credit',
        amount: '75.00',
        reference_id: sharedRef
      });
    expect(tx2.status).toBe(201);
  });

  // 10. Nonexistent account returns 404
  test('10. Nonexistent account returns 404', async () => {
    const res = await request(app).get('/api/v1/accounts/999999');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');

    const txRes = await request(app)
      .post('/api/v1/transactions')
      .send({
        account_id: 999999,
        type: 'credit',
        amount: '10.00',
        reference_id: 'REF-NONEXIST'
      });
    expect(txRes.status).toBe(404);
  });

  // 11. Transaction history filtering works
  test('11. Transaction history filtering works', async () => {
    const acc = await request(app).post('/api/v1/accounts').send({ name: 'Filter Test Acc' });
    const accId = acc.body.data.id;

    // Credit 200
    await request(app).post('/api/v1/transactions').send({
      account_id: accId,
      type: 'credit',
      amount: '200.00',
      reference_id: 'REF-F-CREDIT'
    });

    // Debit 50
    await request(app).post('/api/v1/transactions').send({
      account_id: accId,
      type: 'debit',
      amount: '50.00',
      reference_id: 'REF-F-DEBIT'
    });

    // Filter by credit only
    const creditHistory = await request(app).get(`/api/v1/accounts/${accId}/transactions?type=credit`);
    expect(creditHistory.status).toBe(200);
    expect(creditHistory.body.data.transactions.length).toBe(1);
    expect(creditHistory.body.data.transactions[0].type).toBe('credit');

    // Filter by debit only
    const debitHistory = await request(app).get(`/api/v1/accounts/${accId}/transactions?type=debit`);
    expect(debitHistory.status).toBe(200);
    expect(debitHistory.body.data.transactions.length).toBe(1);
    expect(debitHistory.body.data.transactions[0].type).toBe('debit');

    // Return both when no filter
    const allHistory = await request(app).get(`/api/v1/accounts/${accId}/transactions`);
    expect(allHistory.body.data.transactions.length).toBe(2);
  });

  // 12. Pagination returns correct metadata
  test('12. Pagination returns correct metadata', async () => {
    const acc = await request(app).post('/api/v1/accounts').send({ name: 'Pagination Acc' });
    const accId = acc.body.data.id;

    // Create 5 transactions
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/api/v1/transactions').send({
        account_id: accId,
        type: 'credit',
        amount: '10.00',
        reference_id: `REF-PAG-${i}`
      });
    }

    const res = await request(app).get(`/api/v1/accounts/${accId}/transactions?page=2&limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3
    });
    expect(res.body.data.transactions.length).toBe(2);
  });

  // 13. Failed database operation rolls back
  test('13. Failed database operation rolls back', async () => {
    const acc = await request(app).post('/api/v1/accounts').send({ name: 'Rollback Test Acc' });
    const accId = acc.body.data.id;

    await request(app).post('/api/v1/transactions').send({
      account_id: accId,
      type: 'credit',
      amount: '100.00',
      reference_id: 'REF-RB-SEED'
    });

    // Deliberately trigger failed debit beyond balance
    const failedRes = await request(app).post('/api/v1/transactions').send({
      account_id: accId,
      type: 'debit',
      amount: '500.00',
      reference_id: 'REF-RB-FAIL'
    });

    expect(failedRes.status).toBe(400);

    // Verify balance unchanged
    const balanceRes = await request(app).get(`/api/v1/accounts/${accId}/balance`);
    expect(balanceRes.body.data.balance).toBe('100.00');

    // Verify no debit transaction was committed
    const txRes = await request(app).get(`/api/v1/accounts/${accId}/transactions?type=debit`);
    expect(txRes.body.data.transactions.length).toBe(0);
  });

  // 14. Concurrent debits cannot overdraw an account
  test('14. Concurrent debits cannot overdraw an account', async () => {
    const acc = await request(app).post('/api/v1/accounts').send({ name: 'Concurrency Test Acc' });
    const accId = acc.body.data.id;

    // Credit 100.00
    await request(app).post('/api/v1/transactions').send({
      account_id: accId,
      type: 'credit',
      amount: '100.00',
      reference_id: 'REF-CONC-SEED'
    });

    // Send 5 concurrent debits of 40.00 each
    // 100.00 can only satisfy two 40.00 debits (2 * 40 = 80). Exactly 2 must succeed, 3 must fail.
    const debitPromises = [1, 2, 3, 4, 5].map((i) =>
      request(app)
        .post('/api/v1/transactions')
        .send({
          account_id: accId,
          type: 'debit',
          amount: '40.00',
          reference_id: `REF-CONC-DEBIT-${i}`
        })
    );

    const results = await Promise.all(debitPromises);
    const successfulDebits = results.filter((r) => r.status === 201);
    const failedDebits = results.filter((r) => r.status === 400);

    expect(successfulDebits.length).toBe(2);
    expect(failedDebits.length).toBe(3);

    // Final balance must be exactly 20.00
    const balanceRes = await request(app).get(`/api/v1/accounts/${accId}/balance`);
    expect(balanceRes.body.data.balance).toBe('20.00');
  });

  // 15. Successful transfer updates both accounts
  test('15. Successful transfer updates both accounts', async () => {
    const sourceAcc = await request(app).post('/api/v1/accounts').send({ name: 'Transfer Source' });
    const destAcc = await request(app).post('/api/v1/accounts').send({ name: 'Transfer Dest' });

    const sourceId = sourceAcc.body.data.id;
    const destId = destAcc.body.data.id;

    // Credit 300 to source
    await request(app).post('/api/v1/transactions').send({
      account_id: sourceId,
      type: 'credit',
      amount: '300.00',
      reference_id: 'REF-TF-SRC-SEED'
    });

    // Execute transfer of 120.00
    const transferRes = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: sourceId,
        to_account_id: destId,
        amount: '120.00',
        reference_id: 'REF-TRANSFER-SUCCESS',
        description: 'Vendor payment settlement'
      });

    expect(transferRes.status).toBe(201);
    expect(transferRes.body.success).toBe(true);
    expect(transferRes.body.data.from_account.new_balance).toBe('180.00');
    expect(transferRes.body.data.to_account.new_balance).toBe('120.00');

    // Check balances
    const srcBal = await request(app).get(`/api/v1/accounts/${sourceId}/balance`);
    const dstBal = await request(app).get(`/api/v1/accounts/${destId}/balance`);

    expect(srcBal.body.data.balance).toBe('180.00');
    expect(dstBal.body.data.balance).toBe('120.00');
  });

  // 16. Failed transfer rolls back completely
  test('16. Failed transfer rolls back completely', async () => {
    const sourceAcc = await request(app).post('/api/v1/accounts').send({ name: 'Fail Transfer Src' });
    const destAcc = await request(app).post('/api/v1/accounts').send({ name: 'Fail Transfer Dst' });

    const sourceId = sourceAcc.body.data.id;
    const destId = destAcc.body.data.id;

    // Credit 50 to source, 20 to dest
    await request(app).post('/api/v1/transactions').send({
      account_id: sourceId,
      type: 'credit',
      amount: '50.00',
      reference_id: 'REF-FAIL-TF-SRC'
    });
    await request(app).post('/api/v1/transactions').send({
      account_id: destId,
      type: 'credit',
      amount: '20.00',
      reference_id: 'REF-FAIL-TF-DST'
    });

    // Attempt to transfer 100.00 (exceeds available 50.00)
    const failRes = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: sourceId,
        to_account_id: destId,
        amount: '100.00',
        reference_id: 'REF-TRANSFER-FAIL'
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.code).toBe('INSUFFICIENT_BALANCE');

    // Balances must remain strictly unchanged
    const srcBal = await request(app).get(`/api/v1/accounts/${sourceId}/balance`);
    const dstBal = await request(app).get(`/api/v1/accounts/${destId}/balance`);

    expect(srcBal.body.data.balance).toBe('50.00');
    expect(dstBal.body.data.balance).toBe('20.00');
  });

  // 17. Retried transfer cannot move funds twice
  test('17. Retried transfer cannot move funds twice', async () => {
    const sourceAcc = await request(app).post('/api/v1/accounts').send({ name: 'Retry Src' });
    const destAcc = await request(app).post('/api/v1/accounts').send({ name: 'Retry Dst' });

    const sourceId = sourceAcc.body.data.id;
    const destId = destAcc.body.data.id;

    await request(app).post('/api/v1/transactions').send({
      account_id: sourceId,
      type: 'credit',
      amount: '200.00',
      reference_id: 'REF-RETRY-SRC'
    });

    const transferPayload = {
      from_account_id: sourceId,
      to_account_id: destId,
      amount: '60.00',
      reference_id: 'REF-TRANSFER-IDEMPOTENT-01'
    };

    // First attempt
    const firstAttempt = await request(app).post('/api/v1/transfers').send(transferPayload);
    expect(firstAttempt.status).toBe(201);
    expect(firstAttempt.body.data.from_account.new_balance).toBe('140.00');
    expect(firstAttempt.body.data.to_account.new_balance).toBe('60.00');

    // Retry attempt with same reference_id
    const retryAttempt = await request(app).post('/api/v1/transfers').send(transferPayload);
    expect(retryAttempt.status).toBe(409);
    expect(retryAttempt.body.code).toBe('DUPLICATE_TRANSFER_REFERENCE');

    // Balances must not have moved a second time
    const srcBal = await request(app).get(`/api/v1/accounts/${sourceId}/balance`);
    const dstBal = await request(app).get(`/api/v1/accounts/${destId}/balance`);

    expect(srcBal.body.data.balance).toBe('140.00');
    expect(dstBal.body.data.balance).toBe('60.00');
  });
});
