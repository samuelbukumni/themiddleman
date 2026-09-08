import Link from "next/link";
import { notFound } from "next/navigation";

const documents: Record<string, { title: string; summary: string }> = {
  privacy: { title: "Privacy policy", summary: "We use account and order information only to provide the marketplace, protect transactions, and communicate essential updates. We do not sell personal information." },
  terms: { title: "Terms of service", summary: "The Middleman provides a marketplace and escrow workflow for buyers and sellers. Each party is responsible for accurate briefs, lawful work, and clear communication." },
  refunds: { title: "Refund & dispute policy", summary: "Funds remain in escrow until delivery is approved. If there is a disagreement, either party can request a review before payment is released." },
  disclaimer: { title: "Marketplace disclaimer", summary: "Sellers are independent providers. The Middleman verifies participation information and facilitates protected payments, but buyers should review each offer carefully." },
};
export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params; const page = documents[document]; if (!page) notFound();
  return <main className="min-h-screen bg-ink text-bone"><header className="border-b border-line"><div className="mx-auto max-w-4xl px-6 py-5"><Link href="/" className="font-display text-lg font-bold">The Middleman</Link></div></header><article className="mx-auto max-w-3xl px-6 py-20"><p className="text-xs font-medium tracking-[.2em] text-ember">LEGAL</p><h1 className="mt-4 font-display text-4xl font-bold">{page.title}</h1><p className="mt-8 text-lg leading-relaxed text-slate">{page.summary}</p><p className="mt-6 text-sm leading-relaxed text-slate">For questions about this policy or an active order, contact <a className="text-bone underline" href="mailto:hello@themiddleman.com.ng">hello@themiddleman.com.ng</a>.</p></article></main>;
}
