import { createBrowserClient } from '@supabase/ssr';

// Real client — replaces the old mock. Requires schema.sql,
// auth_trigger.sql, and storage_policies.sql to have been run in the
// Supabase SQL editor, and a private 'verification-docs' storage
// bucket to exist, or signUp/upsert/upload calls will fail against
// tables and policies that don't exist yet.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
