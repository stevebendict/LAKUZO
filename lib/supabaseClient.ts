import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Define a global variable to hold the instance during hot-reloads
const globalForSupabase = global as unknown as { supabase: any };

export const supabase = 
  globalForSupabase.supabase || 
  createClient(supabaseUrl, supabaseAnonKey);

// Save the instance to the global variable in development
if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase;
}
