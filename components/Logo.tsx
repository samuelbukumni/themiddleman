import Link from "next/link";

type LogoVariant = "responsive" | "horizontal" | "vertical" | "symbol" | "dark" | "mono";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return <img src="/brand/middleman-symbol.svg" alt="The Middleman" className={className} />;
}

export default function Logo({
  href = "/",
  className = "",
  markClass = "h-6 w-6",
  textClass = "text-lg",
  variant = "responsive",
}: {
  href?: string;
  className?: string;
  markClass?: string;
  textClass?: string;
  variant?: LogoVariant;
}) {
  const imageClass = variant === "responsive" ? "logo-responsive" : "logo-fixed";
  const fixedSource = variant === "horizontal"
    ? "/brand/middleman-logo-horizontal.svg"
    : variant === "vertical"
      ? "/brand/middleman-logo-vertical.svg"
      : variant === "dark"
        ? "/brand/middleman-logo-dark.svg"
        : variant === "mono"
          ? "/brand/middleman-logo-mono.svg"
      : "/brand/middleman-symbol.svg";

  return (
    <Link href={href} aria-label="The Middleman homepage" className={`flex items-center gap-2.5 ${className}`}>
      {variant === "responsive" ? (
        <picture>
          <source media="(max-width: 767px)" srcSet="/brand/middleman-symbol.svg" />
          <img src="/brand/middleman-logo-horizontal.svg" alt="The Middleman" className={`${imageClass} object-contain`} />
        </picture>
      ) : (
        <img src={fixedSource} alt="The Middleman" className={`${imageClass} object-contain`} />
      )}
    </Link>
  );
}
