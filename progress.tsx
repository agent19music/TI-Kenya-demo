import type { HTMLAttributes } from "react";

type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value: number;
};

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Progress({ value, className, ...props }: ProgressProps) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      role="progressbar"
      className={joinClasses("h-1.5 w-full overflow-hidden rounded-sm bg-[var(--color-surface-muted)]", className)}
      {...props}
    >
      <div className="h-full rounded-sm bg-[var(--color-accent)] transition-[width] duration-200 ease-out" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
