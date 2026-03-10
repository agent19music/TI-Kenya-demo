"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

const statusOptions = ["Pending Review", "Investigating", "Archived"] as const;
const categoryOptions = [
  "Bribery",
  "Embezzlement",
  "Police Harassment",
  "Public Utilities/Services",
  "Electoral Fraud",
  "Spam/Abusive",
  "General/Noise",
] as const;
const priorityOptions = ["High", "Medium", "Low"] as const;
const agencyOptions = ["EACC", "IPOA", "CAJ"] as const;

const templateByAgency: Record<AllowedAgency, string> = {
  EACC: "A-65dbd13a7f44a3782c23",
  IPOA: "A-5574d04596369c40d426",
  CAJ: "A-4046f10c21f9e5ce75c2",
};

type AllowedCategory = (typeof categoryOptions)[number];
type AllowedPriority = (typeof priorityOptions)[number];
type AllowedAgency = (typeof agencyOptions)[number];

type GeminiResponse = {
  category?: unknown;
  priority?: unknown;
  confidence?: unknown;
  summary?: unknown;
  recommendedAgency?: unknown;
  requiresIpoaForm?: unknown;
};

type TriageResult = {
  category: AllowedCategory;
  priority: AllowedPriority;
  confidence: number;
  summary: string;
  recommendedAgency: AllowedAgency | null;
  requiresIpoaForm: boolean;
};

function isValidStatus(value: string): value is (typeof statusOptions)[number] {
  return statusOptions.some((status) => status === value);
}

function isValidAgency(value: string): value is AllowedAgency {
  return agencyOptions.some((agency) => agency === value);
}

function mapAgencyFromCategory(category: AllowedCategory): AllowedAgency | null {
  if (category === "Police Harassment") {
    return "IPOA";
  }

  if (category === "Bribery" || category === "Embezzlement") {
    return "EACC";
  }

  if (category === "Public Utilities/Services" || category === "Electoral Fraud") {
    return "CAJ";
  }

  return null;
}

function inferIpoaFormRequirement(rawComplaint: string, category: AllowedCategory): boolean {
  if (category === "Police Harassment") {
    return true;
  }

  const text = rawComplaint.toLowerCase();
  return /\b(police|ocpd|ocs|dci|traffic police)\b/i.test(text);
}

function buildPrompt(rawComplaint: string): string {
  return `You are an expert legal triage AI for Transparency International Kenya.
Use Kenyan public-sector context and terms (for example OCPD, OCS, DCI, county askari, traffic police, chief, MCA, MP, county offices, huduma offices).
Return strict JSON only with this exact schema: {"category":"one of [Bribery, Embezzlement, Police Harassment, Public Utilities/Services, Electoral Fraud, Spam/Abusive, General/Noise]","priority":"one of [High, Medium, Low]","confidence":"integer 0-100","summary":"one sentence summary","recommendedAgency":"one of [EACC, IPOA, CAJ] or null","requiresIpoaForm":"boolean"}.
Rules:
- If the report mentions police officers or police command titles (including OCPD/OCS/DCI/traffic police) and abuse, extortion, or bribery, category MUST be "Police Harassment".
- If category is "Police Harassment", recommendedAgency should be "IPOA" and requiresIpoaForm should be true.
- For "Bribery" or "Embezzlement", recommendedAgency should usually be "EACC".
- For service injustice, abuse of administrative process, or rights-related public complaints, recommendedAgency can be "CAJ".
- Use "Bribery" for non-police bribery/extortion scenarios.
- Do not use "General/Noise" when a specific agency or misconduct is clearly described.
Complaint: "${rawComplaint}"`;
}

function normalizeGeminiModel(model: string): string {
  const normalized = model.trim().replace(/^models\//i, "");
  if (!normalized) {
    throw new Error("Gemini model is empty.");
  }

  return normalized;
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini response was empty.");
  }

  const candidate = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text || "").join("").trim();

  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function parseAndValidateTriage(rawComplaint: string, rawJson: string): TriageResult {
  let parsed: GeminiResponse;

  try {
    parsed = JSON.parse(rawJson) as GeminiResponse;
  } catch {
    throw new Error("Gemini did not return valid JSON.");
  }

  const category = categoryOptions.find((option) => option === parsed.category);
  const priority = priorityOptions.find((option) => option === parsed.priority);
  const confidence = typeof parsed.confidence === "number" ? Math.round(parsed.confidence) : Number.NaN;
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const recommendedAgency = agencyOptions.find((option) => option === parsed.recommendedAgency) || null;
  const requiresIpoaForm = typeof parsed.requiresIpoaForm === "boolean" ? parsed.requiresIpoaForm : false;

  if (!category || !priority || Number.isNaN(confidence) || confidence < 0 || confidence > 100 || !summary) {
    throw new Error("Gemini returned an invalid triage payload.");
  }

  return {
    category,
    priority,
    confidence,
    summary,
    recommendedAgency: recommendedAgency ?? mapAgencyFromCategory(category),
    requiresIpoaForm: requiresIpoaForm || inferIpoaFormRequirement(rawComplaint, category),
  };
}

function buildKenyanContextFallback(rawComplaint: string): TriageResult {
  const text = rawComplaint.toLowerCase();
  const mentionsPolice = /\b(police|cop|ocpd|ocs|dci|traffic police|askari)\b/i.test(text);
  const mentionsBribery = /\b(bribe|bribery|kitu kidogo|chai|toa kitu|extort|kickback)\b/i.test(text);

  if (mentionsPolice && mentionsBribery) {
    return {
      category: "Police Harassment",
      priority: "High",
      confidence: 88,
      summary: "Report alleges police-linked bribery or extortion in Kenya.",
      recommendedAgency: "IPOA",
      requiresIpoaForm: true,
    };
  }

  if (mentionsPolice) {
    return {
      category: "Police Harassment",
      priority: "Medium",
      confidence: 78,
      summary: "Report alleges misconduct involving police officers in Kenya.",
      recommendedAgency: "IPOA",
      requiresIpoaForm: true,
    };
  }

  if (mentionsBribery) {
    return {
      category: "Bribery",
      priority: "Medium",
      confidence: 74,
      summary: "Report alleges bribery involving public service delivery.",
      recommendedAgency: "EACC",
      requiresIpoaForm: false,
    };
  }

  return {
    category: "General/Noise",
    priority: "Low",
    confidence: 45,
    summary: "Insufficient specific details for confident categorization.",
    recommendedAgency: null,
    requiresIpoaForm: false,
  };
}

function applyKenyanContextOverride(rawComplaint: string, triage: TriageResult): TriageResult {
  const fallback = buildKenyanContextFallback(rawComplaint);
  const mentionsPolice = /\b(police|cop|ocpd|ocs|dci|traffic police|askari)\b/i.test(rawComplaint.toLowerCase());

  if (mentionsPolice && triage.category !== "Police Harassment") {
    return {
      ...fallback,
      confidence: Math.max(fallback.confidence, triage.confidence),
    };
  }

  return {
    ...triage,
    recommendedAgency: triage.recommendedAgency ?? mapAgencyFromCategory(triage.category),
    requiresIpoaForm: triage.requiresIpoaForm || inferIpoaFormRequirement(rawComplaint, triage.category),
  };
}

async function triageWithGemini(rawComplaint: string) {
  const env = getEnv();
  const model = normalizeGeminiModel(env.GEMINI_MODEL);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(rawComplaint) }] }],
      generationConfig: {
        temperature: 0.1,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}. ${body}`.trim());
  }

  const payload = (await response.json()) as unknown;
  const rawJson = extractGeminiText(payload);
  return parseAndValidateTriage(rawComplaint, rawJson);
}

function buildDispatchPayload(args: {
  agency: AllowedAgency;
  recipientEmail: string;
  complaint: {
    id: string;
    raw_complaint: string;
    ai_category: string;
    ai_priority: string;
    ai_confidence: number;
    ai_summary: string | null;
    report_county: string | null;
    sender_city: string | null;
    sender_country: string | null;
    created_at: string;
    requires_ipoa_form: boolean;
  };
}) {
  const env = getEnv();

  return {
    from: {
      email: env.AUTOSEND_FROM_EMAIL,
      name: env.AUTOSEND_FROM_NAME,
    },
    to: [
      {
        email: args.recipientEmail,
        name: args.agency,
      },
    ],
    cc: env.AUTOSEND_CC_EMAIL
      ? [
          {
            email: env.AUTOSEND_CC_EMAIL,
          },
        ]
      : undefined,
    template_id: templateByAgency[args.agency],
    data: {
      complaint_id: args.complaint.id,
      complaint_text: args.complaint.raw_complaint,
      ai_summary: args.complaint.ai_summary || "No summary available",
      ai_category: args.complaint.ai_category,
      ai_priority: args.complaint.ai_priority,
      ai_confidence: args.complaint.ai_confidence,
      report_county: args.complaint.report_county || "Unknown",
      sender_location: [args.complaint.sender_city, args.complaint.sender_country].filter(Boolean).join(", ") || "Unknown",
      submitted_at: args.complaint.created_at,
      requires_ipoa_form: args.complaint.requires_ipoa_form ? "Yes" : "No",
    },
  };
}

async function setDispatchFailure(complaintId: string, message: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("complaints")
    .update({
      dispatch_status: "Failed",
      dispatch_error: message.slice(0, 1000),
    })
    .eq("id", complaintId);
}

export async function updateComplaintStatus(formData: FormData) {
  const complaintId = String(formData.get("complaintId") || "").trim();
  const status = String(formData.get("status") || "").trim();

  if (!complaintId || !isValidStatus(status)) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("complaints").update({ status }).eq("id", complaintId);

  revalidatePath("/admin/triage");
}

export async function retriageComplaint(formData: FormData) {
  const complaintId = String(formData.get("complaintId") || "").trim();

  if (!complaintId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: complaint, error } = await supabase
    .from("complaints")
    .select("id, raw_complaint")
    .eq("id", complaintId)
    .single();

  if (error || !complaint) {
    return;
  }

  try {
    const modelTriage = await triageWithGemini(complaint.raw_complaint);
    const triage = applyKenyanContextOverride(complaint.raw_complaint, modelTriage);

    await supabase
      .from("complaints")
      .update({
        ai_category: triage.category,
        ai_priority: triage.priority,
        ai_confidence: triage.confidence,
        ai_summary: triage.summary,
        triage_status: "Completed",
        triage_error: null,
        recommended_agency: triage.recommendedAgency,
        requires_ipoa_form: triage.requiresIpoaForm,
      })
      .eq("id", complaint.id);
  } catch (retriageError) {
    const fallback = buildKenyanContextFallback(complaint.raw_complaint);
    const message = retriageError instanceof Error ? retriageError.message : "Unknown triage error";

    await supabase
      .from("complaints")
      .update({
        ai_category: fallback.category,
        ai_priority: fallback.priority,
        ai_confidence: fallback.confidence,
        ai_summary: fallback.summary,
        triage_status: "Fallback",
        triage_error: message.slice(0, 1000),
        recommended_agency: fallback.recommendedAgency,
        requires_ipoa_form: fallback.requiresIpoaForm,
      })
      .eq("id", complaint.id);
  }

  revalidatePath("/admin/triage");
}

export async function dispatchComplaint(formData: FormData) {
  const complaintId = String(formData.get("complaintId") || "").trim();
  const agency = String(formData.get("agency") || "").trim();
  const ipoaAcknowledged = String(formData.get("ipoaAcknowledged") || "").trim() === "yes";

  if (!complaintId || !isValidAgency(agency)) {
    return;
  }

  const env = getEnv();
  const recipientByAgency: Record<AllowedAgency, string> = {
    EACC: env.AUTOSEND_TO_EACC,
    IPOA: env.AUTOSEND_TO_IPOA,
    CAJ: env.AUTOSEND_TO_CAJ,
  };

  const supabase = createSupabaseAdminClient();
  const { data: complaint, error } = await supabase
    .from("complaints")
    .select(
      "id, raw_complaint, ai_category, ai_priority, ai_confidence, ai_summary, report_county, sender_city, sender_country, created_at, recommended_agency, requires_ipoa_form, dispatch_status",
    )
    .eq("id", complaintId)
    .single();

  if (error || !complaint) {
    return;
  }

  if (complaint.dispatch_status === "Sent") {
    return;
  }

  if (agency === "IPOA" && complaint.requires_ipoa_form && !ipoaAcknowledged) {
    await setDispatchFailure(complaintId, "IPOA dispatch requires explicit form acknowledgment.");
    revalidatePath("/admin/triage");
    return;
  }

  const recipientEmail = recipientByAgency[agency];
  if (!env.AUTOSEND_API_KEY) {
    await setDispatchFailure(complaintId, "Missing AUTOSEND_API_KEY configuration.");
    revalidatePath("/admin/triage");
    return;
  }

  if (!recipientEmail) {
    await setDispatchFailure(complaintId, `Missing recipient email configuration for ${agency}.`);
    revalidatePath("/admin/triage");
    return;
  }

  const payload = buildDispatchPayload({
    agency,
    recipientEmail,
    complaint,
  });

  try {
    const response = await fetch("https://api.autosend.com/v1/mails/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AUTOSEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      await setDispatchFailure(complaintId, `AutoSend failed (${response.status}): ${body}`);
      revalidatePath("/admin/triage");
      return;
    }

    await supabase
      .from("complaints")
      .update({
        dispatch_status: "Sent",
        dispatched_at: new Date().toISOString(),
        dispatch_error: null,
      })
      .eq("id", complaintId);
  } catch (errorMessage) {
    const message = errorMessage instanceof Error ? errorMessage.message : "Unknown dispatch error";
    await setDispatchFailure(complaintId, message);
  }

  revalidatePath("/admin/triage");
}
