// public/js/config.js
// Replace these with your actual Supabase project values

const CONFIG = {
  SUPABASE_URL: 'https://axmoiivacqimzwwhdrsk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_5IDSdCLSoFNlTx0mbEdDQA_roETZ63m',
  API_BASE: '/api',
};

// Initialise Supabase client (used only for auth on the frontend)
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
