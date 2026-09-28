import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { sameOriginMutation } from '../lib/server/same-origin.mjs';

export const buyerId = '00000000-0000-4000-8000-000000000001';
export const gigId = '20000000-0000-4000-8000-000000000001';
export const sellerId = '30000000-0000-4000-8000-000000000001';
export const key = '40000000-0000-4000-8000-000000000001';
export const orderId = '10000000-0000-4000-8000-000000000001';
export function orderRequest(body = { gigId }, headers = {}) {
  return new Request('https://example.test/api/orders', {
    method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json', 'idempotency-key': key, ...headers },
    body: JSON.stringify(body),
  });
}

// Execute the actual TypeScript route with only external I/O replaced.
export async function orderRoute({ user = { id: buyerId }, sellerUserId = 'seller-auth-id', existing = null, insertError = null, racedOrder = null } = {}) {
  const inserts = [];
  let lookups = 0;
  const admin = { from(table) {
    let inserted;
    const filters = {};
    const query = {
      select() { return query; },
      eq(column, value) { filters[column] = value; return query; },
      insert(value) { inserted = value; inserts.push(value); return query; },
      async maybeSingle() {
        if (table === 'gigs') return { data: { id: gigId, seller_id: sellerId, price_ngn: 5000, status: 'active', seller_profiles: { user_id: sellerUserId } } };
        if (filters.buyer_id !== user.id || filters.idempotency_key !== key) throw new Error('Unscoped lookup');
        return { data: lookups++ ? racedOrder : existing };
      },
      async single() { return { data: insertError ? null : { id: orderId, ...inserted }, error: insertError }; },
    };
    return query;
  } };
  const source = await readFile(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modules = {
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: user ? null : new Error('Unauthorized') }) } }) },
    '@supabase/supabase-js': { createClient: () => admin },
    'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
    'next/server': { NextResponse: Response },
    '@/lib/server/same-origin.mjs': { sameOriginMutation },
  };
  const exports = {};
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'server-test' };
  new Function('require', 'exports', 'process', compiled)((name) => {
    if (!modules[name]) throw new Error(`Unexpected import ${name}`);
    return modules[name];
  }, exports, { env });
  return { POST: exports.POST, inserts };
}
