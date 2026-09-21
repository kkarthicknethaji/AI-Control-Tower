export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl?: string;
  apiReferenceUrl?: string;
}

export function getEnv(): AppEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || undefined;
  const apiReferenceUrl = import.meta.env.VITE_CT_API_REFERENCE_URL?.trim() || undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create ai-control-tower-react/.env.local from .env.example.');
  }

  if (supabaseAnonKey.includes('service_role') || supabaseAnonKey.toLowerCase().includes('secret')) {
    throw new Error('A service-role or secret key cannot be used in the browser. Provide the Supabase anon key.');
  }

  return { supabaseUrl, supabaseAnonKey, apiBaseUrl, apiReferenceUrl };
}
