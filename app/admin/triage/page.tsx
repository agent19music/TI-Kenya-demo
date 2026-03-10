import type { Database } from "@/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TriageDashboard } from "@/app/admin/triage/triage-dashboard";

export const dynamic = "force-dynamic";

type ComplaintRow = Database["public"]["Tables"]["complaints"]["Row"];

type FetchResult = {
  complaints: ComplaintRow[];
  errorMessage: string | null;
};

function normalizeAttachmentUrl(input: string | null): string | null {
  if (!input) {
    return null;
  }

  try {
    const parsed = new URL(input);
    if (!parsed.hostname.endsWith("r2.cloudflarestorage.com")) {
      return parsed.toString();
    }

    const publicBase = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "");
    if (!publicBase) {
      return input;
    }

    const bucket = process.env.R2_BUCKET?.trim();
    let keyPath = parsed.pathname.replace(/^\/+/, "");

    if (bucket && keyPath.startsWith(`${bucket}/`)) {
      keyPath = keyPath.slice(bucket.length + 1);
    }

    return `${publicBase}/${keyPath}`;
  } catch {
    return input;
  }
}

async function fetchComplaints(): Promise<FetchResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("complaints")
      .select(
        "id, raw_complaint, complaint_hash, ai_category, ai_priority, ai_confidence, ai_summary, triage_status, triage_error, sender_country, sender_city, report_county, reporter_age_group, reporter_sex, has_disability, is_anonymous, reporter_phone, attachment_url, attachment_mime, attachment_name, attachment_size_bytes, duplicate_count, last_received_at, recommended_agency, requires_ipoa_form, dispatch_status, dispatched_at, dispatch_error, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return {
        complaints: [],
        errorMessage: "Could not load complaints right now.",
      };
    }

    const complaints = (data || []).map((complaint) => ({
      ...complaint,
      attachment_url: normalizeAttachmentUrl(complaint.attachment_url),
    }));

    return {
      complaints,
      errorMessage: null,
    };
  } catch {
    return {
      complaints: [],
      errorMessage: "Could not load complaints right now.",
    };
  }
}

export default async function AdminTriagePage() {
  const { complaints, errorMessage } = await fetchComplaints();

  return (
    <>
      {errorMessage ? (
        <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10">
          <section className="rounded-sm border border-[#fecdca] bg-[#fff3f2] px-4 py-3 text-sm text-[#b42318]" role="alert">
            {errorMessage}
          </section>
        </main>
      ) : (
        <TriageDashboard complaints={complaints} />
      )}
    </>
  );
}
