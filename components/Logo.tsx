import Link from "next/link";

type LogoVariant = "responsive" | "horizontal" | "vertical" | "symbol" | "dark" | "mono";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return <img src="/brand/middleman-approved-master.png" alt="The Middleman" className={`${className} object-contain`} />;
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
  return (
    <Link href={href} aria-label="The Middleman homepage" className={`flex items-center ${className}`}>
      <img
        src="/brand/middleman-approved-master.png"
        alt="The Middleman"
        className="h-auto w-24 object-contain sm:w-28 md:w-32"
      />
    </Link>
  );
}
