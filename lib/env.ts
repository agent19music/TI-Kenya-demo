type RequiredEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "GEMINI_API_KEY";

type Env = Record<RequiredEnvKey, string> & {
  GEMINI_MODEL: string;
  AUTOSEND_API_KEY: string;
  AUTOSEND_FROM_EMAIL: string;
  AUTOSEND_FROM_NAME: string;
  AUTOSEND_CC_EMAIL: string;
  AUTOSEND_TO_EACC: string;
  AUTOSEND_TO_IPOA: string;
  AUTOSEND_TO_CAJ: string;
};

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getEnv(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    GEMINI_API_KEY: readRequiredEnv("GEMINI_API_KEY"),
    GEMINI_MODEL: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    AUTOSEND_API_KEY: process.env.AUTOSEND_API_KEY?.trim() || "",
    AUTOSEND_FROM_EMAIL: process.env.AUTOSEND_FROM_EMAIL?.trim() || "tikenya@uzskicorp.agency",
    AUTOSEND_FROM_NAME: process.env.AUTOSEND_FROM_NAME?.trim() || "TI-Kenya demo",
    AUTOSEND_CC_EMAIL: process.env.AUTOSEND_CC_EMAIL?.trim() || "collabs@uzskicorp.agency",
    AUTOSEND_TO_EACC: process.env.AUTOSEND_TO_EACC?.trim() || "",
    AUTOSEND_TO_IPOA: process.env.AUTOSEND_TO_IPOA?.trim() || "",
    AUTOSEND_TO_CAJ: process.env.AUTOSEND_TO_CAJ?.trim() || "",
  };
}
