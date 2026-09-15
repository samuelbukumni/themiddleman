import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Middleman",
  description: "Verified digital products and code, escrow-backed, Nigeria-wide.",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/app-icon.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html dir="ltr" lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-bone">
        {children}
      </body>
    </html>
  );
}
