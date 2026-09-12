import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M10 6H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 6h4a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="13.5" y="4" width="5" height="24" rx="2.5" fill="#F26419" />
    </svg>
  );
}

export default function Logo({
  href = "/",
  className = "",
  markClass = "h-6 w-6",
  textClass = "text-lg",
}: {
  href?: string;
  className?: string;
  markClass?: string;
  textClass?: string;
}) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClass} />
      <span className={`font-display font-bold tracking-tight ${textClass}`}>The Middleman</span>
    </Link>
  );
}
