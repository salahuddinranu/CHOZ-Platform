// CHOZ Configuration
const SUPABASE_URL = 'https://frqokteoccfxfszmhkht.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fOQFhkrxgysqcewSXcPtMg_G5KcOCo3';

// Create CHOZ Supabase client
window.chozSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
