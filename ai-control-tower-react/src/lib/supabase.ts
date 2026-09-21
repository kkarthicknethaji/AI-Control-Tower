import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}
