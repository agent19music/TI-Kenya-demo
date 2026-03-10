"use client";

import { useMemo, useState, useTransition } from "react";

import { dispatchComplaint, retriageComplaint, updateComplaintStatus } from "@/app/admin/triage/actions";
import { Badge } from "@/badge";
import type { Database } from "@/database.types";
import { Progress } from "@/progress";

type ComplaintRow = Database["public"]["Tables"]["complaints"]["Row"];

type TriageDashboardProps = {
  complaints: ComplaintRow[];
};

const statusOptions = ["Pending Review", "Investigating", "Archived"] as const;
const statusFilters = ["All", ...statusOptions] as const;
const dispatchAgencies = ["EACC", "IPOA", "CAJ"] as const;

type DispatchAgency = (typeof dispatchAgencies)[number];

type DispatchModalState = {
  complaintId: string;
  recommendedAgency: string | null;
  draft: {
    agency: DispatchAgency;
    recipientEmail: string;
    complaintText: string;
    aiSummary: string;
    aiCategory: string;
    aiPriority: string;
    aiConfidence: string;
    reportCounty: string;
    senderLocation: string;
    submittedAt: string;
    requiresIpoaForm: boolean;
  };
};

function toPriorityVariant(priority: string): "high" | "medium" | "low" {
  if (priority === "High") {
    return "high";
  }

  if (priority === "Medium") {
    return "medium";
  }

  return "low";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toInputDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function truncateText(text: string, maxLength = 120): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}...`;
}

function isImageAttachment(mime: string | null, name: string | null): boolean {
  if (mime?.startsWith("image/")) {
    return true;
  }

  if (!name) {
    return false;
  }

  return /\.(png|jpe?g)$/i.test(name);
}

export function TriageDashboard({ complaints }: TriageDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("All");
  const [sortMode, setSortMode] = useState<"latest" | "priority">("latest");
  const [dispatchModal, setDispatchModal] = useState<DispatchModalState | null>(null);
  const [ipoaAcknowledged, setIpoaAcknowledged] = useState(false);
  const [activeDispatchKey, setActiveDispatchKey] = useState<string | null>(null);
  const [isDispatchPending, startDispatchTransition] = useTransition();

  const now = new Date();
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const totalComplaintsToday = complaints.filter((item) => new Date(item.created_at) >= startOfTodayUtc).length;
  const highPriorityAlerts = complaints.filter((item) => item.ai_priority === "High").length;
  const openCases = complaints.filter((item) => item.status !== "Archived").length;
  const averageConfidence = complaints.length
    ? Math.round(complaints.reduce((acc, item) => acc + item.ai_confidence, 0) / complaints.length)
    : 0;

  const filteredComplaints = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const filtered = complaints.filter((complaint) => {
      const matchesSearch =
        needle.length === 0 ||
        complaint.raw_complaint.toLowerCase().includes(needle) ||
        complaint.ai_category.toLowerCase().includes(needle) ||
        complaint.ai_priority.toLowerCase().includes(needle);

      const matchesStatus = statusFilter === "All" ? true : complaint.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    if (sortMode === "latest") {
      return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const priorityRank: Record<string, number> = {
      High: 3,
      Medium: 2,
      Low: 1,
    };

    return filtered.sort((a, b) => {
      const rankDiff = (priorityRank[b.ai_priority] || 0) - (priorityRank[a.ai_priority] || 0);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [complaints, searchTerm, sortMode, statusFilter]);

  const statusCounts = useMemo(() => {
    return {
      "Pending Review": complaints.filter((item) => item.status === "Pending Review").length,
      Investigating: complaints.filter((item) => item.status === "Investigating").length,
      Archived: complaints.filter((item) => item.status === "Archived").length,
    };
  }, [complaints]);

  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();

    for (const complaint of complaints) {
      counts.set(complaint.ai_category, (counts.get(complaint.ai_category) || 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [complaints]);

  const alertQueue = useMemo(() => {
    return complaints.filter((item) => item.ai_priority === "High" && item.status !== "Archived").slice(0, 4);
  }, [complaints]);

  function openDispatchModal(complaint: ComplaintRow, agency: DispatchAgency) {
    setIpoaAcknowledged(false);
    setDispatchModal({
      complaintId: complaint.id,
      recommendedAgency: complaint.recommended_agency,
      draft: {
        agency,
        recipientEmail: "",
        complaintText: complaint.raw_complaint,
        aiSummary: complaint.ai_summary || "No summary available",
        aiCategory: complaint.ai_category,
        aiPriority: complaint.ai_priority,
        aiConfidence: String(complaint.ai_confidence),
        reportCounty: complaint.report_county || "Unknown",
        senderLocation: [complaint.sender_city, complaint.sender_country].filter(Boolean).join(", ") || "Unknown",
        submittedAt: toInputDateTime(complaint.created_at),
        requiresIpoaForm: complaint.requires_ipoa_form,
      },
    });
  }

  function closeDispatchModal() {
    if (isDispatchPending) {
      return;
    }

    setDispatchModal(null);
    setIpoaAcknowledged(false);
  }

  function confirmDispatch() {
    if (!dispatchModal) {
      return;
    }

    const requiresAcknowledgement = dispatchModal.draft.agency === "IPOA" && dispatchModal.draft.requiresIpoaForm;
    if (requiresAcknowledgement && !ipoaAcknowledged) {
      return;
    }

    const formData = new FormData();
    formData.set("complaintId", dispatchModal.complaintId);
    formData.set("agency", dispatchModal.draft.agency);
    formData.set("recipientEmail", dispatchModal.draft.recipientEmail);
    formData.set("complaintText", dispatchModal.draft.complaintText);
    formData.set("aiSummary", dispatchModal.draft.aiSummary);
    formData.set("aiCategory", dispatchModal.draft.aiCategory);
    formData.set("aiPriority", dispatchModal.draft.aiPriority);
    formData.set("aiConfidence", dispatchModal.draft.aiConfidence);
    formData.set("reportCounty", dispatchModal.draft.reportCounty);
    formData.set("senderLocation", dispatchModal.draft.senderLocation);
    formData.set("submittedAt", dispatchModal.draft.submittedAt);
    formData.set("requiresIpoaForm", dispatchModal.draft.requiresIpoaForm ? "yes" : "no");
    formData.set("ipoaAcknowledged", ipoaAcknowledged ? "yes" : "no");

    setActiveDispatchKey(`${dispatchModal.complaintId}:${dispatchModal.draft.agency}`);
    startDispatchTransition(async () => {
      await dispatchComplaint(formData);
      setDispatchModal(null);
      setIpoaAcknowledged(false);
      setActiveDispatchKey(null);
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--color-text)] sm:text-4xl">Anti-Corruption Triage</h1>
        <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
          Review incoming public complaints, prioritize urgent integrity risks, and move each case through clear investigative states.
        </p>
      </div>

      <section className="mb-8 grid grid-cols-2 overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] lg:grid-cols-4">
        {[
          { label: "Open Cases", value: openCases },
          { label: "Complaints Today", value: totalComplaintsToday },
          { label: "High Priority Alerts", value: highPriorityAlerts },
          { label: "Avg. AI Confidence", value: `${averageConfidence}%` },
        ].map((stat, index) => (
          <article
            key={stat.label}
            className={`border-[var(--color-border)] px-5 py-4 ${
              index % 2 === 0 ? "border-r" : ""
            } ${index < 2 ? "border-b lg:border-b-0" : ""} ${index === 1 ? "lg:border-r" : ""}`}
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--color-text)]">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="grid overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] lg:grid-cols-3">
        <div className="lg:col-span-2 lg:border-r lg:border-[var(--color-border)]">
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold tracking-[-0.01em] text-[var(--color-text)]">Complaint Queue</h2>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search complaint text, category, or priority"
              className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] sm:max-w-xs"
            />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as "latest" | "priority")}
              className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] sm:w-48"
              aria-label="Sort complaints"
            >
              <option value="latest">Sort: Latest</option>
              <option value="priority">Sort: Priority</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] px-5 py-3">
            {statusFilters.map((filter) => {
              const isActive = statusFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-sm border px-3 py-1.5 text-xs transition-colors duration-200 ease-in-out ${
                    isActive
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-white"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] px-5 py-2.5">
            {[
              { label: "High", color: "#C20019" },
              { label: "Medium", color: "#FF8C00" },
              { label: "Low", color: "#6b6b6b" },
            ].map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                {item.label} Priority
              </span>
            ))}
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-[var(--color-text-secondary)]">No complaints match your filters.</div>
          ) : (
            <div>
              {filteredComplaints.map((complaint) => (
                <article key={complaint.id} className="relative border-b border-[var(--color-border)] px-5 py-4 last:border-b-0">
                  <span
                    className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        complaint.ai_priority === "High" ? "#C20019" : complaint.ai_priority === "Medium" ? "#FF8C00" : "#6b6b6b",
                    }}
                    title={`${complaint.ai_priority} priority`}
                    aria-label={`${complaint.ai_priority} priority`}
                  />
                  <div className="grid gap-4 lg:grid-cols-[170px,1fr,130px,150px] lg:items-start">
                    <div>
                      <p className="text-xs text-[var(--color-text-tertiary)]">Submitted</p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatDate(complaint.created_at)}</p>
                    </div>

                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-sm text-sm leading-6 text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
                        <span>{truncateText(complaint.raw_complaint)}</span>
                        <span className="shrink-0 rounded-sm border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors duration-200 group-hover:bg-[var(--color-surface-muted)] group-open:bg-[var(--color-surface-muted)]">
                          <span className="group-open:hidden">View details</span>
                          <span className="hidden group-open:inline">Hide details</span>
                        </span>
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{complaint.raw_complaint}</p>
                      {complaint.ai_summary ? (
                        <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">AI summary: {complaint.ai_summary}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-tertiary)]">
                        <span>
                          Location: {complaint.sender_city || "Unknown"}
                          {complaint.sender_country ? `, ${complaint.sender_country}` : ""}
                        </span>
                        <span>County: {complaint.report_county || "Unknown"}</span>
                        <span>Duplicates: {complaint.duplicate_count}</span>
                        <span>Triage: {complaint.triage_status}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={toPriorityVariant(complaint.ai_priority)}>{complaint.ai_priority}</Badge>
                        <Badge variant="neutral">{complaint.ai_category}</Badge>
                        {complaint.recommended_agency ? <Badge variant="neutral">Route: {complaint.recommended_agency}</Badge> : null}
                      </div>
                      {complaint.attachment_url ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-[var(--color-text-tertiary)]">Attached file</p>
                          {isImageAttachment(complaint.attachment_mime, complaint.attachment_name) ? (
                            <a href={complaint.attachment_url} target="_blank" rel="noreferrer" className="block w-fit">
                              <img
                                src={complaint.attachment_url}
                                alt={complaint.attachment_name || "Complaint attachment"}
                                className="h-24 w-24 rounded-sm border border-[var(--color-border)] object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              href={complaint.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                            >
                              {complaint.attachment_name || "Open attachment"}
                            </a>
                          )}
                        </div>
                      ) : null}
                      {complaint.triage_status === "Failed" && complaint.triage_error ? (
                        <p className="mt-2 rounded-sm border border-[#fecdca] bg-[#fff3f2] px-2 py-1 text-xs text-[#b42318]">
                          AI triage failed: {truncateText(complaint.triage_error, 140)}
                        </p>
                      ) : null}

                      <section className="mt-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Actions</h4>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                          <span>Recommended: {complaint.recommended_agency || "Not set"}</span>
                          <span>Dispatch: {complaint.dispatch_status}</span>
                          {complaint.dispatched_at ? <span>Sent: {formatDate(complaint.dispatched_at)}</span> : null}
                        </div>
                        {complaint.dispatch_error ? (
                          <p className="mt-2 rounded-sm border border-[#fecdca] bg-[#fff3f2] px-2 py-1 text-xs text-[#b42318]" role="alert">
                            Dispatch error: {truncateText(complaint.dispatch_error, 160)}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
                          {dispatchAgencies.map((agency) => {
                            const isSent = complaint.dispatch_status === "Sent";
                            const dispatchKey = `${complaint.id}:${agency}`;
                            const isCurrentDispatch = activeDispatchKey === dispatchKey;
                            const isDisabled = isSent || isDispatchPending;

                            return (
                              <button
                                key={agency}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => openDispatchModal(complaint, agency)}
                                className="inline-flex h-9 items-center rounded-sm border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors duration-200 ease-in-out hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isCurrentDispatch && isDispatchPending ? `Sending to ${agency}...` : `Dispatch to ${agency}`}
                              </button>
                            );
                          })}
                        </div>
                        {complaint.requires_ipoa_form ? (
                          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                            IPOA safeguard: this complaint requires explicit IPOA form acknowledgment before dispatch.
                          </p>
                        ) : null}
                      </section>
                    </details>

                    <div className="space-y-2">
                      <p className="text-xs text-[var(--color-text-tertiary)]">Confidence</p>
                      <p className="text-sm font-medium text-[var(--color-text)]">{complaint.ai_confidence}%</p>
                      <p className="text-xs leading-5 text-[var(--color-text-tertiary)]">
                        AI confidence is the model&apos;s certainty in its own category and priority recommendation.
                      </p>
                      <Progress value={complaint.ai_confidence} />
                    </div>

                    <form action={updateComplaintStatus} className="space-y-2">
                      <input type="hidden" name="complaintId" value={complaint.id} />
                      <label className="text-xs text-[var(--color-text-tertiary)]" htmlFor={`status-${complaint.id}`}>
                        Case Status
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          id={`status-${complaint.id}`}
                          name="status"
                          defaultValue={complaint.status}
                          className="h-9 min-w-0 flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center rounded-sm border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors duration-200 ease-in-out hover:bg-[var(--color-surface-muted)]"
                        >
                          Save
                        </button>
                      </div>
                      <button
                        formAction={retriageComplaint}
                        type="submit"
                        className="inline-flex h-9 items-center rounded-sm border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors duration-200 ease-in-out hover:bg-[var(--color-surface-muted)]"
                      >
                        Re-triage
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-text-tertiary)]">
            Showing {filteredComplaints.length} of {complaints.length} complaints.
          </p>
        </div>

        <aside>
          <section className="border-b border-[var(--color-border)] px-5 py-5">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Integrity Alert Queue</h3>
            {alertQueue.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No active high-priority alerts.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {alertQueue.map((alert) => (
                  <li key={alert.id} className="rounded-sm border border-[var(--color-border)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">{formatDate(alert.created_at)}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text)]">{truncateText(alert.raw_complaint, 88)}</p>
                    <div className="mt-2">
                      <Badge variant="high">High Priority</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-b border-[var(--color-border)] px-5 py-5">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Top Categories</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No categorized complaints yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {categoryBreakdown.map(([category, count]) => (
                  <li key={category} className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 text-sm last:border-b-0 last:pb-0">
                    <span className="text-[var(--color-text-secondary)]">{category}</span>
                    <span className="font-medium text-[var(--color-text)]">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="px-5 py-5">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Pipeline</h3>
            <ul className="mt-3 space-y-2">
              {statusOptions.map((status) => (
                <li key={status} className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 text-sm last:border-b-0 last:pb-0">
                  <span className="text-[var(--color-text-secondary)]">{status}</span>
                  <span className="font-medium text-[var(--color-text)]">{statusCounts[status]}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      {dispatchModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true" aria-labelledby="dispatch-modal-title">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-2xl sm:max-h-[85vh]">
            <h2 id="dispatch-modal-title" className="text-lg font-semibold text-[var(--color-text)]">
              Confirm Dispatch to {dispatchModal.draft.agency}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Review and edit the outgoing dispatch payload before sending.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                Dispatch to
                <select
                  value={dispatchModal.draft.agency}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, agency: event.target.value as DispatchAgency },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                >
                  {dispatchAgencies.map((agency) => (
                    <option key={agency} value={agency}>
                      {agency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                Recipient email (optional override)
                <input
                  type="email"
                  value={dispatchModal.draft.recipientEmail}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, recipientEmail: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  placeholder="Use configured agency email when blank"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)] sm:col-span-2">
                Complaint text
                <textarea
                  value={dispatchModal.draft.complaintText}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, complaintText: event.target.value },
                          }
                        : previous,
                    )
                  }
                  rows={6}
                  className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)] sm:col-span-2">
                AI summary
                <textarea
                  value={dispatchModal.draft.aiSummary}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, aiSummary: event.target.value },
                          }
                        : previous,
                    )
                  }
                  rows={4}
                  className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                AI category
                <input
                  value={dispatchModal.draft.aiCategory}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, aiCategory: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                AI priority
                <input
                  value={dispatchModal.draft.aiPriority}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, aiPriority: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                AI confidence
                <input
                  type="number"
                  value={dispatchModal.draft.aiConfidence}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, aiConfidence: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                County
                <input
                  value={dispatchModal.draft.reportCounty}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, reportCounty: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)] sm:col-span-2">
                Sender location
                <input
                  value={dispatchModal.draft.senderLocation}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, senderLocation: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                Submitted at
                <input
                  type="datetime-local"
                  value={dispatchModal.draft.submittedAt}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, submittedAt: event.target.value },
                          }
                        : previous,
                    )
                  }
                  className="h-9 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="inline-flex items-center gap-2 pt-6 text-xs text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={dispatchModal.draft.requiresIpoaForm}
                  onChange={(event) =>
                    setDispatchModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: { ...previous.draft, requiresIpoaForm: event.target.checked },
                          }
                        : previous,
                    )
                  }
                />
                Requires IPOA form
              </label>
            </div>
            {dispatchModal.recommendedAgency && dispatchModal.recommendedAgency !== dispatchModal.draft.agency ? (
              <p className="mt-2 rounded-sm border border-[#fecdca] bg-[#fff3f2] px-3 py-2 text-xs text-[#b42318]">
                AI recommended {dispatchModal.recommendedAgency}, but you selected {dispatchModal.draft.agency}. Confirm to continue.
              </p>
            ) : null}
            {dispatchModal.draft.agency === "IPOA" && dispatchModal.draft.requiresIpoaForm ? (
              <div className="mt-3 rounded-sm border border-[#fecdca] bg-[#fff3f2] p-3">
                <p className="text-xs text-[#b42318]">This complaint requires IPOA form confirmation before send.</p>
                <label className="mt-2 inline-flex items-start gap-2 text-xs text-[#b42318]">
                  <input
                    type="checkbox"
                    checked={ipoaAcknowledged}
                    onChange={(event) => setIpoaAcknowledged(event.target.checked)}
                    className="mt-0.5"
                  />
                  I confirm the IPOA form requirement has been reviewed for this dispatch.
                </label>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDispatchModal}
                disabled={isDispatchPending}
                className="inline-flex h-9 items-center rounded-sm border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors duration-200 ease-in-out hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDispatch}
                disabled={
                  isDispatchPending ||
                  (dispatchModal.draft.agency === "IPOA" && dispatchModal.draft.requiresIpoaForm && !ipoaAcknowledged)
                }
                className="inline-flex h-9 items-center rounded-sm border border-[var(--color-text)] bg-[var(--color-text)] px-3 text-xs font-semibold text-white transition-colors duration-200 ease-in-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDispatchPending ? "Sending..." : `Confirm and Dispatch to ${dispatchModal.draft.agency}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
