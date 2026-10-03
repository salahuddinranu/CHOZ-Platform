// CHOZ Configuration — Supabase credentials
const SUPABASE_URL = 'https://frqokteoccfxfszmhkht.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fOQFhkrxgysqcewSXcPtMg_G5KcOCo3';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
