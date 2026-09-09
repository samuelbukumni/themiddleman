import { createBrowserClient } from '@supabase/ssr';

// Real client — replaces the old mock. Requires schema.sql,
// auth_trigger.sql, and storage_policies.sql to have been run in the
// Supabase SQL editor, and a private 'verification-docs' storage
// bucket to exist, or signUp/upsert/upload calls will fail against
// tables and policies that don't exist yet.
//
// Falls back to placeholder values when env vars are absent at build
// time so prerendering never crashes (e.g. CI, or Next not loading
// .env.local during the export phase). Real calls still fail loudly
// at runtime if these are placeholders — that's expected.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    '[supabaseClient] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
    'Using placeholder values — Supabase calls will fail until real env vars are set.'
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);