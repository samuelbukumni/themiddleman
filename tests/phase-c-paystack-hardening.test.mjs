// Retain the recovered Phase C signed-webhook and real SQL rollback/replay tests.
import './phase-c-payments.test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createVerificationHandler } from '../lib/paystack-verify.mjs';

const id = '10000000-0000-4000-8000-000000000001';
const reference = `mm_${id}`;
const user = { id: 'buyer' };
const order = { id, buyer_id: user.id, amount: '5000', status: 'pending_payment' };
const payment = { reference, amount: 500000, currency: 'NGN', status: 'success', domain: 'test' };
function request(body = { reference, orderId: id }, origin = 'https://example.test') {
  return new Request('https://example.test/api/payments/verify', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function fixture(overrides = {}) {
  const calls = [];
  const handler = createVerificationHandler({ secret: 'sk_test_unit_test_only',
    authenticate: async () => user, findOrder: async () => order,
    verifyFetch: async (url, options) => {
      assert.equal(url, `https://api.paystack.co/transaction/verify/${reference}`);
      assert.equal(options.headers.Authorization, 'Bearer sk_test_unit_test_only');
      return Response.json({ status: true, data: payment });
    },
    settle: async data => { calls.push(data); return 'recorded'; }, ...overrides,
  });
  return { handler, calls };
}

test('correct server-verified payment ignores browser-supplied amount', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request({ reference, orderId: id, amount: 1 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, duplicate: false });
  assert.deepEqual(calls, [payment]);
});

for (const [name, change] of [
  ['manipulated amount', { amount: 1 }], ['overpayment', { amount: 500001 }],
  ['failed Paystack transaction', { status: 'failed' }], ['wrong currency', { currency: 'USD' }],
  ['wrong returned reference', { reference: 'mm_10000000-0000-4000-8000-000000000002' }],
  ['live transaction with test secret', { domain: 'live' }],
]) test(`verification rejects ${name}`, async () => {
  const { handler, calls } = fixture({ verifyFetch: async () => Response.json({ status: true, data: { ...payment, ...change } }) });
  assert.equal((await handler(request())).status, 402);
  assert.equal(calls.length, 0);
});

test('wrong order/reference and unauthorized verification cannot finalize', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request({ reference, orderId: 'other' }))).status, 400);
  assert.equal((await handler(request(null))).status, 400);
  assert.equal((await handler(request(undefined, 'https://attacker.test'))).status, 403);
  assert.equal((await fixture({ authenticate: async () => null }).handler(request())).status, 401);
  const foreign = fixture({ findOrder: async () => ({ ...order, buyer_id: 'someone-else' }) });
  assert.equal((await foreign.handler(request())).status, 404);
  assert.equal(foreign.calls.length, 0);
  assert.equal(calls.length, 0);
});

test('verification returns success for an already recorded payment without rejecting escrow state', async () => {
  const { handler } = fixture({ findOrder: async () => ({ ...order, status: 'in_escrow' }), settle: async () => 'duplicate' });
  assert.deepEqual(await (await handler(request())).json(), { ok: true, duplicate: true });
});

test('upstream and atomic finalization failures never report success', async () => {
  for (const verifyFetch of [async () => { throw new Error('timeout'); }, async () => Response.json({}, { status: 503 }), async () => Response.json({ status: false, data: payment })]) {
    const { handler, calls } = fixture({ verifyFetch });
    assert.equal((await handler(request())).status, 502);
    assert.equal(calls.length, 0);
  }
  assert.equal((await fixture({ settle: async () => { throw new Error('rollback'); } }).handler(request())).status, 500);
});
