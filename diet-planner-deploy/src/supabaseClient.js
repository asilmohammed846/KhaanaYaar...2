import { createClient } from '@supabase/supabase-js';

// Use env variables in Vite via import.meta.env
// For the mockup, we fall back to placeholders if missing.
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
if (!supabaseUrl.startsWith('http')) {
  supabaseUrl = 'https://mock.supabase.co';
}
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
