import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/database.types";
import { getEnv } from "@/lib/env";

export function createSupabaseServerClient() {
  const env = getEnv();

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
