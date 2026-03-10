import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-2xl flex-col items-center gap-12">

        <div className="flex items-center gap-6 sm:gap-10">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/TI-Kenya-Logo.jpg"
              alt="Transparency International Kenya"
              className="h-12 w-auto object-contain sm:h-14"
            />
          </div>

          <span
            className="select-none text-2xl font-light text-[var(--color-text-tertiary)] sm:text-3xl"
            aria-hidden="true"
          >
            ×
          </span>

          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/uzski-logo-nobg.png"
              alt="Uzski Corp"
              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text)] sm:text-4xl">
            TI-Kenya &times; Uzski Corp
          </h2>
          <p className="max-w-md text-base leading-7 text-[var(--color-text-secondary)]">
            AI workflow tools demo  on complaint intake, intelligent triage, and
            agency dispatch for anti-corruption reporting.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/report"
            className="inline-flex h-11 items-center rounded-sm bg-[var(--color-text)] px-6 text-sm font-semibold text-white transition-opacity duration-200 ease-in-out hover:opacity-85"
          >
            Submit a Report
          </Link>
          <Link
            href="/admin/triage"
            className="inline-flex h-11 items-center rounded-sm border border-[var(--color-border)] px-6 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 ease-in-out hover:bg-[var(--color-surface-muted)]"
          >
            Admin Triage
          </Link>
        </div>

      </div>
    </main>
  );
}
