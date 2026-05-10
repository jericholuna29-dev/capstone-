import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured. Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  cachedClient = createClient(supabaseUrl, supabaseKey);
  return cachedClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = getSupabaseClient() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(client, property, receiver);

    if (typeof value === 'function') {
      return (value as Function).bind(client);
    }

    return value;
  },
});
