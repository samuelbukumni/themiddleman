import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Middleman",
  description: "Verified digital products and code, escrow-backed, Nigeria-wide.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-bone">
        {children}
      </body>
    </html>
  );
}
