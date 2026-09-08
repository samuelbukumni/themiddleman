"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StarRatingDisplay } from "@/components/StarRating";
import SiteHeader from "@/components/SiteHeader";

// Brand tokens (match homepage): Ink #0D0D0D bg, Ember #F26419 accent,
// Bone #F5F2EC primary text, Slate #8C8C8C secondary text, Paper #171717 card bg.
//
// Design direction: gigs are rendered as ticket/receipt stubs rather than generic
// SaaS cards — a torn perforation line and side notches, monospace pricing like a
// till total, and a tilted ink-stamp badge for verified sellers. This is deliberate:
// escrow and proof-of-transaction are the platform's core trust differentiator, so
// the card itself should read like a physical proof-of-transaction artifact.
//
// Data layer: pulls from public.gigs (status = 'active'), joined with
// public.seller_profiles for the seller's name and verification status.
// Requires supabase/schema.sql to have been run — see README notes.

type GigCategory = "development" | "design" | "marketing" | "writing" | "ai_assisted";

type GigRow = {
  id: string;
  title: string;
  description: string;
  category: GigCategory;
  price_ngn: number;
  is_ai_assisted: boolean;
  seller_profiles: {
    display_name: string;
    verification_status: string;
  } | null;
};

type GigRating = {
  gig_id: string;
  average_rating: number;
  review_count: number;
};

const CATEGORY_LABELS: Record<GigCategory, string> = {
  development: "Development",
  design: "Design",
  marketing: "Marketing",
  writing: "Writing",
  ai_assisted: "AI-assisted",
};

const CATEGORIES: Array<{ value: GigCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "development", label: "Development" },
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing" },
  { value: "writing", label: "Writing" },
  { value: "ai_assisted", label: "AI-assisted" },
];

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function EscrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function VerifiedStamp() {
  return (
    <div
      className="absolute -top-2.5 right-4 w-[52px] h-[52px] rounded-full border-2 border-[#F26419] bg-white flex items-center justify-center shadow-sm"
      style={{ transform: "rotate(-10deg)" }}
      aria-label="Verified seller"
    >
      <span className="font-display font-bold text-[8px] text-[#F26419] text-center leading-tight">
        VERIFIED
      </span>
    </div>
  );
}

function GigTicket({ gig, rating }: { gig: GigRow; rating?: GigRating }) {
  const sellerName = gig.seller_profiles?.display_name ?? "Unknown seller";
  const verified = gig.seller_profiles?.verification_status === "approved";

  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="mp-ticket relative block rounded px-5 pt-5 pb-4"
    >
      {verified && <VerifiedStamp />}

      <div className="absolute -left-2 top-[66px] w-4 h-4 rounded-full bg-white border border-[#ECE8E0]" />
      <div className="absolute -right-2 top-[66px] w-4 h-4 rounded-full bg-white border border-[#ECE8E0]" />

      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[34px] h-[34px] rounded-full bg-[#FBF4EC] border border-[#ECE8E0] flex items-center justify-center font-display font-bold text-xs text-[#171717]">
          {initialsFrom(sellerName)}
        </div>
        <div>
          <p className="text-[13px] font-medium text-[#171717]">{sellerName}</p>
          <StarRatingDisplay average={rating?.average_rating ?? 0} count={rating?.review_count ?? 0} size={11} />
        </div>
      </div>

      <div
        className="-mx-5 h-px mb-4"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, #ECE8E0 0 6px, transparent 6px 12px)",
        }}
      />

      <p className="text-[10px] uppercase tracking-wider text-[#A39C8E] mb-1.5">
        {CATEGORY_LABELS[gig.category]}
      </p>
      <p className="font-display font-bold text-[15px] leading-snug mb-1.5 text-[#171717]">
        {gig.title}
      </p>
      <p className="text-[13px] text-[#8C8577] mb-5 leading-relaxed">{gig.description}</p>

      <div className="flex items-center justify-between pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#8C8577]">
          <EscrowIcon />
          Escrow protected
        </span>
        <span className="font-mono text-base text-[#171717]">
          ₦{gig.price_ngn.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const [gigs, setGigs] = useState<GigRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, GigRating>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<GigCategory | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGigs() {
      setLoading(true);
      setFetchError(null);

      const [gigsResult, ratingsResult] = await Promise.all([
        supabase
          .from("gigs")
          .select(
            "id, title, description, category, price_ngn, is_ai_assisted, seller_profiles ( display_name, verification_status )"
          )
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase.rpc("get_gig_ratings"),
      ]);

      if (cancelled) return;

      if (gigsResult.error) {
        setFetchError(gigsResult.error.message);
        setGigs([]);
      } else {
        setGigs((gigsResult.data as unknown as GigRow[]) ?? []);
      }

      const ratingsMap: Record<string, GigRating> = {};
      ((ratingsResult.data as GigRating[]) ?? []).forEach((row) => {
        ratingsMap[row.gig_id] = row;
      });
      setRatings(ratingsMap);

      setLoading(false);
    }

    loadGigs();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredGigs = gigs.filter((gig) => {
    const matchesCategory = activeCategory === "all" || gig.category === activeCategory;
    const haystack = `${gig.title} ${gig.seller_profiles?.display_name ?? ""}`.toLowerCase();
    const matchesQuery = query.trim() === "" || haystack.includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="mp-shell">
      <div className="mp-blob mp-blob-1" />
      <div className="mp-blob mp-blob-2" />
      <div className="mp-blob mp-blob-3" />

      <SiteHeader />

      <div className="mp-content mx-auto max-w-7xl px-6 py-12 sm:py-14">

        <div className="mb-6 flex items-end justify-between rounded-3xl border border-line bg-white/75 p-6 shadow-[0_18px_50px_rgba(31,21,12,.08)] backdrop-blur-sm">
          <div>
            <p className="text-[13px] text-slate mt-1">
              Verified digital products and code, escrow-backed, Nigeria-wide
            </p>
          </div>
          <div className="flex items-center gap-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, code, templates, sellers"
              className="w-56 rounded-full border border-line bg-white px-4 py-2 text-sm text-bone placeholder-slate shadow-sm focus:outline-none focus:border-ember transition-colors"
            />
            <Link
              href="/gigs/new"
              className="rounded-full bg-ember px-5 py-2.5 text-[13px] font-semibold text-ink shadow-lg shadow-ember/20 transition-all hover:-translate-y-0.5 hover:bg-ember/90"
            >
              List a product
            </Link>
          </div>
        </div>

        <div className="mb-8 flex gap-3 overflow-x-auto pb-1">
          {CATEGORIES.map((category) => {
            const active = activeCategory === category.value;
            return (
              <button
                key={category.value}
                onClick={() => setActiveCategory(category.value)}
                className={
                  "mp-tab whitespace-nowrap rounded-full border px-4 py-2 text-[13px] transition-all " +
                  (active ? "border-ember bg-ember/10 text-bone shadow-sm" : "border-line bg-white/70 text-slate hover:border-ember/30 hover:text-bone")
                }
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="text-sm text-slate">Loading products…</p>
        )}

        {!loading && fetchError && (
          <div className="rounded-2xl border border-line bg-white/80 p-5 text-sm text-slate shadow-sm">
            Couldn&apos;t load products right now ({fetchError}). This usually means{" "}
            <code className="text-ember">supabase/schema.sql</code> hasn&apos;t been run against your
            project yet.
          </div>
        )}

        {!loading && !fetchError && filteredGigs.length === 0 && (
          <p className="text-sm text-slate">
            No products match that search yet. Try a different term or category.
          </p>
        )}

        {!loading && !fetchError && filteredGigs.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGigs.map((gig) => (
              <GigTicket key={gig.id} gig={gig} rating={ratings[gig.id]} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
