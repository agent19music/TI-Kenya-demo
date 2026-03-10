"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { FileArrowUpIcon } from "@phosphor-icons/react";

type SubmissionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

type AttachmentUploadState = {
  file: File | null;
  uploading: boolean;
  progress: number;
  url: string | null;
  mime: string | null;
  size: number | null;
  error: string | null;
};

function SubmitButton({ pending }: { pending: boolean }) {

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[var(--color-text)] px-4 py-2 text-sm font-semibold text-white transition-opacity duration-200 ease-in-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          Submitting...
        </span>
      ) : (
        "Submit "
      )}
    </button>
  );
}

export default function ReportPage() {
  const [state, setState] = useState<SubmissionState>({ status: "idle" });
  const [pending, setPending] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState("yes");
  const [attachment, setAttachment] = useState<AttachmentUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    url: null,
    mime: null,
    size: null,
    error: null,
  });
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  function simulateProgress(onComplete: () => Promise<void>) {
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 14;
      if (progress > 90) {
        progress = 90;
      }

      setAttachment((previous) => ({
        ...previous,
        progress,
      }));
    }, 180);

    onComplete()
      .then(() => {
        clearInterval(interval);
        setAttachment((previous) => ({
          ...previous,
          progress: 100,
          uploading: false,
        }));
      })
      .catch((error) => {
        clearInterval(interval);
        setAttachment((previous) => ({
          ...previous,
          uploading: false,
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed.",
        }));
      });
  }

  async function uploadAttachment(file: File) {
    setAttachment({
      file,
      uploading: true,
      progress: 0,
      url: null,
      mime: file.type,
      size: file.size,
      error: null,
    });

    simulateProgress(async () => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/report/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        success?: boolean;
        url?: string;
        contentType?: string;
        size?: number;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.error || "Upload failed.");
      }

      setAttachment((previous) => ({
        ...previous,
        url: payload.url || null,
        mime: payload.contentType || file.type,
        size: typeof payload.size === "number" ? payload.size : file.size,
        error: null,
      }));
    });
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    uploadAttachment(file).catch(() => undefined);
  }

  function clearAttachment() {
    setAttachment({
      file: null,
      uploading: false,
      progress: 0,
      url: null,
      mime: null,
      size: null,
      error: null,
    });

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const rawComplaint = String(formData.get("raw_complaint") || "").trim();
    const phoneNumber = String(formData.get("phone_number") || "").trim();
    const county = String(formData.get("county") || "").trim();
    const ageGroup = String(formData.get("age_group") || "").trim();
    const sex = String(formData.get("sex") || "").trim();
    const hasDisability = String(formData.get("has_disability") || "").trim();
    const anonymousValue = String(formData.get("is_anonymous") || "yes").trim().toLowerCase();

    if (rawComplaint.length < 12) {
      setState({
        status: "error",
        message: "Please share a little more detail so we can review your report.",
      });
      return;
    }

    if (rawComplaint.length > 5000) {
      setState({
        status: "error",
        message: "Your report is too long. Please keep it under 5000 characters.",
      });
      return;
    }

    if (anonymousValue === "no" && phoneNumber.length < 7) {
      setState({
        status: "error",
        message: "Phone number is required if the report is not anonymous.",
      });
      return;
    }

    if (attachment.uploading) {
      setState({
        status: "error",
        message: "Please wait for file upload to finish before submitting.",
      });
      return;
    }

    setPending(true);
    setState({ status: "idle" });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw_complaint: rawComplaint,
          phone_number: phoneNumber,
          county,
          age_group: ageGroup,
          sex,
          has_disability: hasDisability,
          is_anonymous: anonymousValue,
          attachment_url: attachment.url,
          attachment_name: attachment.file?.name || null,
          attachment_mime: attachment.mime,
          attachment_size_bytes: attachment.size,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const payload = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Request failed.");
      }

      setState({
        status: "success",
        message: payload.message,
      });

      form.reset();
      setIsAnonymous("yes");
      clearAttachment();
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out. Your report may still be processing, please try again in a moment."
          : error instanceof Error
            ? error.message
            : "Unknown error";

      setState({
        status: "error",
        message,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-24 sm:px-8">
      <section className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-10">
        {state.status === "success" ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)]">
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-[var(--color-accent)]" fill="none" aria-hidden="true">
                <path d="M4.5 10.5L8.25 14.25L15.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--color-text)]">Report received</h1>
            <p className="max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
              Thank you. Your report has been securely submitted and routed for triage. You can close this page now.
            </p>
            <Link
              href="/admin/triage"
              className="inline-flex h-10 items-center rounded-sm border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 ease-in-out hover:bg-[var(--color-surface-muted)]"
            >
              View admin triage →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <header className="space-y-3">
              <p className="text-md ">#ReportCorruption</p>
              <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--color-text)] sm:text-4xl">Submit Report</h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
                Share what happened in your own words. Do not include private details you do not want investigators to see.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="is_anonymous" className="text-sm text-[var(--color-text-secondary)]">
                    Do you want your report to be anonymous?
                  </label>
                  <select
                    id="is_anonymous"
                    name="is_anonymous"
                    value={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.value)}
                    className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {isAnonymous === "no" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="phone_number" className="text-sm text-[var(--color-text-secondary)]">
                      What is your phone number?
                    </label>
                    <input
                      id="phone_number"
                      name="phone_number"
                      type="tel"
                      required={isAnonymous === "no"}
                      placeholder="e.g. 0712345678"
                      className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="county" className="block min-h-10 text-sm text-[var(--color-text-secondary)]">
                    What is the county where the issue occurred?
                  </label>
                  <select
                    id="county"
                    name="county"
                    defaultValue=""
                    className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="" disabled>
                      Select county
                    </option>
                    <option>Nairobi</option>
                    <option>Mombasa</option>
                    <option>Kisumu</option>
                    <option>Nakuru</option>
                    <option>Uasin Gishu</option>
                    <option>Kiambu</option>
                    <option>Machakos</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="age_group" className="block min-h-10 text-sm text-[var(--color-text-secondary)]">
                    What is your age group?
                  </label>
                  <select
                    id="age_group"
                    name="age_group"
                    defaultValue=""
                    className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="" disabled>
                      Select age group
                    </option>
                    <option>18-25</option>
                    <option>26-35</option>
                    <option>36-45</option>
                    <option>46-60</option>
                    <option>60+</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="sex" className="text-sm text-[var(--color-text-secondary)]">
                    What is your sex?
                  </label>
                  <select
                    id="sex"
                    name="sex"
                    defaultValue=""
                    className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="has_disability" className="text-sm text-[var(--color-text-secondary)]">
                    Do you have any disability?
                  </label>
                  <select
                    id="has_disability"
                    name="has_disability"
                    defaultValue=""
                    className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option>Yes</option>
                    <option>No</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>

              <label htmlFor="raw_complaint" className="sr-only">
                Complaint details
              </label>
              <textarea
                id="raw_complaint"
                name="raw_complaint"
                rows={8}
                required
                placeholder="tell us about corruption around you"
                className="min-h-40 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-base leading-7 text-[var(--color-text)] outline-none transition-colors duration-200 ease-in-out placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-accent)_18%,white)]"
              />

              <div className="space-y-2">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept=".pdf,.png,.xlsx,.xls,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />

                {!attachment.file ? (
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="w-full rounded-sm border border-dashed border-[var(--color-border)] px-4 py-4 text-left text-sm text-[var(--color-text-secondary)] transition-colors duration-200 hover:bg-[var(--color-surface-muted)]"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-[var(--color-text)]">
                      <FileArrowUpIcon size={16} weight="bold" className="text-[var(--color-accent)]" aria-hidden="true" />
                      Attach relevant files
                    </span>
                    <span className="mt-1 block text-xs text-[var(--color-text-tertiary)]">
                      Allowed: PDF, PNG, XLSX, XLS, JPG, JPEG, DOC, DOCX. Max 25MB.
                    </span>
                  </button>
                ) : (
                  <div className="rounded-sm border border-[var(--color-border)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-[var(--color-text)]">{attachment.file.name}</p>
                      {!attachment.uploading && (
                        <button
                          type="button"
                          onClick={clearAttachment}
                          className="text-xs text-[var(--color-text-secondary)] underline-offset-2 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200 ease-out"
                        style={{ width: `${attachment.progress}%` }}
                      />
                    </div>
                    {attachment.uploading && (
                      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Uploading... {Math.round(attachment.progress)}%</p>
                    )}
                    {!attachment.uploading && attachment.url && (
                      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Uploaded and attached to report.</p>
                    )}
                    {attachment.error && <p className="mt-2 text-xs text-[#b42318]">{attachment.error}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[var(--color-text-tertiary)]">Your submission is processed on secure servers.</p>
                <SubmitButton pending={pending || attachment.uploading} />
              </div>
            </form>

            {state.status === "error" && (
              <p className="rounded-sm border border-[#fecdca] bg-[#fff3f2] px-3 py-2 text-sm text-[#b42318]" role="alert">
                {state.message}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
