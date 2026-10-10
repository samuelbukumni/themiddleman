import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const phaseBMigration = new URL(
  '../supabase/migrations/20260917124827_phase_b_server_authoritative_orders.sql',
  import.meta.url,
);

test('Phase B removes direct inserts and enforces idempotent server writes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin nosuperuser nobypassrls;
      create role authenticated nologin nosuperuser nobypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create type public.order_status as enum (
        'pending_payment', 'in_escrow', 'delivered', 'approved', 'disputed', 'refunded'
      );
      create table public.orders (
        id uuid primary key,
        gig_id uuid not null,
        buyer_id uuid not null,
        seller_id uuid not null,
        amount numeric not null,
        status public.order_status not null default 'pending_payment'
      );
      alter table public.orders enable row level security;
      grant usage on schema public to anon, authenticated;
      grant select, insert, update on public.orders to anon, authenticated;
      create policy "buyers create orders" on public.orders
        for insert with check (auth.uid() = buyer_id);
    `);

    await db.exec(await readFile(phaseBMigration, 'utf8'));
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      '00000000-0000-0000-0000-000000000001',
    ]);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.exec(`
        insert into public.orders
          (id, gig_id, buyer_id, seller_id, amount, idempotency_key)
        values
          ('10000000-0000-0000-0000-000000000001',
           '20000000-0000-0000-0000-000000000001',
           '00000000-0000-0000-0000-000000000001',
           '30000000-0000-0000-0000-000000000001',
           1,
           '40000000-0000-4000-8000-000000000001')
      `),
      { code: '42501' },
    );

    await db.exec('reset role');
    await db.exec(`
      insert into public.orders
        (id, gig_id, buyer_id, seller_id, amount, idempotency_key)
      values
        ('10000000-0000-0000-0000-000000000001',
         '20000000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001',
         '30000000-0000-0000-0000-000000000001',
         5000,
         '40000000-0000-4000-8000-000000000001')
    `);
    assert.equal((await db.query('select amount::int as amount from public.orders')).rows[0].amount, 5000);

    await assert.rejects(
      db.exec(`
        insert into public.orders
          (id, gig_id, buyer_id, seller_id, amount, idempotency_key)
        values
          ('10000000-0000-0000-0000-000000000002',
           '20000000-0000-0000-0000-000000000001',
           '00000000-0000-0000-0000-000000000001',
           '30000000-0000-0000-0000-000000000001',
           999,
           '40000000-0000-4000-8000-000000000001')
      `),
      { code: '23505' },
    );
  } finally {
    await db.close();
  }
});

const { orderRoute, orderRequest, buyerId, sellerId, gigId, orderId, key } = await import('./order-route-fixture.mjs');

test('Phase B endpoint ignores browser identity, seller, amount and status', async () => {
  const { POST, inserts } = await orderRoute();
  const response = await POST(orderRequest({ gigId, buyer_id: 'attacker', seller_id: 'attacker', amount: 1, status: 'in_escrow' }));
  assert.equal(response.status, 201);
  assert.deepEqual(inserts, [{ buyer_id: buyerId, seller_id: sellerId, gig_id: gigId, amount: 5000, status: 'pending_payment', idempotency_key: key }]);
});

test('Phase B endpoint denies unauthorized creation and self-purchase', async () => {
  for (const [options, expected] of [[{ user: null }, 401], [{ sellerUserId: buyerId }, 409]]) {
    const { POST, inserts } = await orderRoute(options);
    assert.equal((await POST(orderRequest())).status, expected);
    assert.equal(inserts.length, 0);
  }
});

test('Phase B endpoint reuses retries and rejects a key for another gig', async () => {
  for (const [existingGig, expected] of [[gigId, 200], ['different-gig', 409]]) {
    const { POST, inserts } = await orderRoute({ existing: { id: orderId, gig_id: existingGig, amount: 5000, status: 'pending_payment' } });
    assert.equal((await POST(orderRequest())).status, expected);
    assert.equal(inserts.length, 0);
  }
  const racedOrder = { id: orderId, gig_id: gigId, amount: 5000, status: 'pending_payment' };
  const { POST } = await orderRoute({ insertError: { code: '23505' }, racedOrder });
  assert.deepEqual(await (await POST(orderRequest())).json(), { order: racedOrder, reused: true });
});

test('Phase B endpoint rejects cross-origin requests and missing idempotency keys', async () => {
  const { POST, inserts } = await orderRoute();
  assert.equal((await POST(orderRequest(undefined, { origin: 'https://attacker.test' }))).status, 403);
  assert.equal((await POST(orderRequest(undefined, { 'idempotency-key': '' }))).status, 400);
  assert.equal(inserts.length, 0);
});
