import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

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

type LocationData = {
  country: string | null;
  city: string | null;
};

type ReportPayload = {
  raw_complaint?: unknown;
  county?: unknown;
  age_group?: unknown;
  sex?: unknown;
  has_disability?: unknown;
  is_anonymous?: unknown;
  phone_number?: unknown;
  attachment_url?: unknown;
  attachment_name?: unknown;
  attachment_mime?: unknown;
  attachment_size_bytes?: unknown;
};

function normalizeAttachmentUrl(input: string | null): string | null {
  if (!input) {
    return null;
  }

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    if (parsed.hostname.endsWith("r2.cloudflarestorage.com")) {
      const publicBase = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "");
      if (!publicBase) {
        return null;
      }

      const bucket = process.env.R2_BUCKET?.trim();
      let keyPath = parsed.pathname.replace(/^\/+/, "");

      if (bucket && keyPath.startsWith(`${bucket}/`)) {
        keyPath = keyPath.slice(bucket.length + 1);
      }

      return `${publicBase}/${keyPath}`;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeComplaint(text: string): string {
  return text.trim();
}

function hashComplaint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

async function getLocationFromIp(ip: string | null): Promise<LocationData> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return { country: null, city: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { country: null, city: null };
    }

    const payload = (await response.json()) as {
      city?: unknown;
      country_name?: unknown;
      error?: unknown;
    };

    if (payload.error) {
      return { country: null, city: null };
    }

    return {
      country: typeof payload.country_name === "string" ? payload.country_name : null,
      city: typeof payload.city === "string" ? payload.city : null,
    };
  } catch {
    return { country: null, city: null };
  }
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

function applyKenyanContextOverride(
  rawComplaint: string,
  triage: TriageResult,
): TriageResult {
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReportPayload;
    const rawComplaint = normalizeComplaint(typeof body.raw_complaint === "string" ? body.raw_complaint : "");
    const county = typeof body.county === "string" ? body.county.trim() : null;
    const ageGroup = typeof body.age_group === "string" ? body.age_group.trim() : null;
    const sex = typeof body.sex === "string" ? body.sex.trim() : null;
    const hasDisability = typeof body.has_disability === "string" ? body.has_disability.trim() : null;
    const isAnonymousRaw = typeof body.is_anonymous === "string" ? body.is_anonymous.trim().toLowerCase() : "yes";
    const isAnonymous = isAnonymousRaw !== "no";
    const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : null;
    const attachmentUrl = normalizeAttachmentUrl(typeof body.attachment_url === "string" ? body.attachment_url.trim() : null);
    const attachmentName = typeof body.attachment_name === "string" ? body.attachment_name.trim() : null;
    const attachmentMime = typeof body.attachment_mime === "string" ? body.attachment_mime.trim() : null;
    const attachmentSizeBytes =
      typeof body.attachment_size_bytes === "number"
        ? body.attachment_size_bytes
        : typeof body.attachment_size_bytes === "string"
          ? Number.parseInt(body.attachment_size_bytes, 10)
          : null;

    if (rawComplaint.length < 12) {
      return NextResponse.json(
        { success: false, message: "Please share a little more detail so we can review your report." },
        { status: 400 },
      );
    }

    if (rawComplaint.length > 5000) {
      return NextResponse.json(
        { success: false, message: "Your report is too long. Please keep it under 5000 characters." },
        { status: 400 },
      );
    }

    if (!isAnonymous && (!phoneNumber || phoneNumber.length < 7)) {
      return NextResponse.json(
        { success: false, message: "Phone number is required when submission is not anonymous." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const complaintHash = hashComplaint(rawComplaint);
    const ip = getClientIp(request);
    const location = await getLocationFromIp(ip);

    const { data: existing } = await supabase
      .from("complaints")
      .select("id, duplicate_count")
      .eq("raw_complaint", rawComplaint)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const duplicateUpdate = await supabase
        .from("complaints")
        .update({
          duplicate_count: (existing.duplicate_count || 1) + 1,
          last_received_at: new Date().toISOString(),
          sender_country: location.country,
          sender_city: location.city,
        })
        .eq("id", existing.id);

      if (duplicateUpdate.error) {
        throw new Error(duplicateUpdate.error.message);
      }

      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Your report has already been received and has been linked to the existing case.",
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("complaints")
      .insert({
        raw_complaint: rawComplaint,
        complaint_hash: complaintHash,
        report_county: county,
        reporter_age_group: ageGroup,
        reporter_sex: sex,
        has_disability: hasDisability,
        is_anonymous: isAnonymous,
        reporter_phone: isAnonymous ? null : phoneNumber,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_mime: attachmentMime,
        attachment_size_bytes: Number.isFinite(attachmentSizeBytes) ? attachmentSizeBytes : null,
        ai_category: "General/Noise",
        ai_priority: "Low",
        ai_confidence: 0,
        ai_summary: "Triage pending.",
        triage_status: "Pending",
        sender_country: location.country,
        sender_city: location.city,
        duplicate_count: 1,
        last_received_at: new Date().toISOString(),
        status: "Pending Review",
        dispatch_status: "Pending",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message || "Failed to store complaint.");
    }

    try {
      const modelTriage = await triageWithGemini(rawComplaint);
      const triage = applyKenyanContextOverride(rawComplaint, modelTriage);

      const triageUpdate = await supabase
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
        .eq("id", inserted.id);

      if (triageUpdate.error) {
        throw new Error(triageUpdate.error.message);
      }
    } catch (triageError) {
      const triageMessage = triageError instanceof Error ? triageError.message : "Unknown triage error";
      const fallback = buildKenyanContextFallback(rawComplaint);

      await supabase
        .from("complaints")
        .update({
          ai_category: fallback.category,
          ai_priority: fallback.priority,
          ai_confidence: fallback.confidence,
          ai_summary: fallback.summary,
          triage_status: "Fallback",
          triage_error: triageMessage.slice(0, 1000),
          recommended_agency: fallback.recommendedAgency,
          requires_ipoa_form: fallback.requiresIpoaForm,
        })
        .eq("id", inserted.id);
    }

    return NextResponse.json({
      success: true,
      duplicate: false,
      message: "Your report has been submitted securely.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        success: false,
        message: `We could not submit your report right now. ${message}`,
      },
      { status: 500 },
    );
  }
}
