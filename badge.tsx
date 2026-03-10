import type { HTMLAttributes } from "react";

type BadgeVariant = "neutral" | "high" | "medium" | "low";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
  high: "bg-[#fff3f2] text-[#C20019] border border-[#fecdca]",
  medium: "bg-[#fffaeb] text-[#FF8C00] border border-[#fedf89]",
  low: "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
};

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-[0.01em]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
