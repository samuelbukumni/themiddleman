"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { StarRatingDisplay } from "@/components/StarRating";
import SiteHeader from "@/components/SiteHeader";

const CATEGORY_LABELS = {
  development: "Development",
  design: "Design",
  marketing: "Marketing",
  writing: "Writing",
  ai_assisted: "AI-assisted",
};

function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment provider. Check your connection."));
    document.body.appendChild(script);
  });
}

export default function GigDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [gig, setGig] = useState(null);
  const [rating, setRating] = useState({ average: 0, count: 0 });
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [messaging, setMessaging] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reportReason, setReportReason] = useState("Spam or misleading content");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled && user) {
        setUserId(user.id);
        setUserEmail(user.email);
      }

      const { data: gigData, error: gigError } = await supabase
        .from("gigs")
        .select(
          "id, title, description, category, price_ngn, is_ai_assisted, seller_id, seller_profiles ( user_id, display_name, bio, verification_status )"
        )
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (gigError || !gigData) {
        setLoadError("This product couldn't be found — it may have been removed.");
        setLoading(false);
        return;
      }
      setGig(gigData);

      const [{ data: ratingsData }, { data: reviewsData }] = await Promise.all([
        supabase.rpc("get_gig_ratings"),
        supabase.rpc("get_gig_reviews", { p_gig_id: id }),
      ]);

      if (cancelled) return;
      const matched = (ratingsData || []).find((row) => row.gig_id === id);
      setRating({ average: matched?.average_rating ?? 0, count: matched?.review_count ?? 0 });
      setReviews(reviewsData || []);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleMessageSeller() {
    setActionError("");
    if (!userId) { router.push("/signup?mode=signin"); return; }
    const sellerUserId = gig.seller_profiles?.user_id;
    if (!sellerUserId) {
      setActionError("We could not load the seller account for this product.");
      return;
    }
    if (userId === sellerUserId) return;

    setMessaging(true);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("buyer_id", userId)
      .eq("seller_id", sellerUserId)
      .eq("gig_id", gig.id)
      .maybeSingle();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: created, error: createError } = await supabase
        .from("conversations")
        .insert({ buyer_id: userId, seller_id: sellerUserId, gig_id: gig.id })
        .select("id")
        .single();
      if (createError) { setActionError(createError.message); setMessaging(false); return; }
      conversationId = created.id;
    }
    router.push(`/messages?conversation=${conversationId}`);
  }

  async function handleBuyAndPay() {
    setActionError("");
    if (!userId) { router.push("/signup?mode=signin"); return; }
    if (userId === gig.seller_id) return;

    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      setActionError("Payments aren't configured yet — add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to .env.local.");
      return;
    }

    setPaying(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: userId,
          seller_id: gig.seller_id,
          gig_id: gig.id,
          amount: gig.price_ngn,
          status: "pending_payment",
        })
        .select("id")
        .single();
      if (orderError) throw new Error(orderError.message);

      await loadPaystackScript();

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: userEmail,
        amount: gig.price_ngn * 100,
        currency: "NGN",
        ref: `mm_${order.id}`,
        callback: (response) => {
          fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, orderId: order.id }),
          })
            .then((res) => res.json())
            .then((result) => {
              if (result.error) {
                setActionError(result.error);
                setPaying(false);
              } else {
                router.push("/orders");
              }
            })
            .catch(() => {
              setActionError("Payment succeeded but we couldn't confirm it — check My Orders in a moment.");
              setPaying(false);
            });
        },
        onClose: () => setPaying(false),
      });
      handler.openIframe();
    } catch (err) {
      setActionError(err.message);
      setPaying(false);
    }
  }

  async function handleDeleteGig() {
    setActionError("");
    if (!userId || userId !== gig.seller_id) return;

    const confirmed = window.confirm("Delete this product? It will no longer appear in the marketplace.");
    if (!confirmed) return;

    const { error } = await supabase.from("gigs").update({ status: "deleted" }).eq("id", gig.id);
    if (error) {
      setActionError(error.message);
      return;
    }

    router.push("/gigs/mine");
  }

  async function handleReportGig() {
    setActionError("");
    setReportSuccess(false);

    if (!userId) {
      router.push("/signup?mode=signin");
      return;
    }

    if (userId === gig.seller_id) {
      setActionError("You cannot report your own product.");
      return;
    }

    setReporting(true);
    const { error } = await supabase.from("gig_reports").insert({
      gig_id: gig.id,
      reported_by: userId,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });

    if (error) {
      setActionError(error.message);
      setReporting(false);
      return;
    }

    setReportSuccess(true);
    setReportDetails("");
    setReporting(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-ink text-bone grid place-items-center">
        <p className="text-sm text-slate">Loading product…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-ink text-bone grid place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-slate mb-4">{loadError}</p>
          <Link href="/marketplace" className="text-ember hover:underline text-sm">Back to marketplace</Link>
        </div>
      </main>
    );
  }

  const verified = gig.seller_profiles?.verification_status === "approved";
  const isOwnGig = userId === gig.seller_profiles?.user_id;

  return (
    <main className="min-h-screen bg-ink text-bone">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-6 py-12 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate mb-2">{CATEGORY_LABELS[gig.category]}</p>
          <h1 className="font-display text-3xl font-bold mb-3">{gig.title}</h1>
          <StarRatingDisplay average={rating.average} count={rating.count} />
          <p className="mt-6 text-sm leading-relaxed text-slate whitespace-pre-wrap">{gig.description}</p>

          {gig.is_ai_assisted && (
            <span className="mt-5 inline-block rounded-full bg-ember/15 px-3 py-1 text-xs font-semibold text-ember">
              AI-assisted
            </span>
          )}

          <div className="mt-10 border-t border-line pt-8">
            <h2 className="font-display text-xl font-bold mb-5">
              Reviews {rating.count > 0 && `(${rating.count})`}
            </h2>
            {reviews.length === 0 && <p className="text-sm text-slate">No reviews yet for this product.</p>}
            <div className="space-y-5">
              {reviews.map((review, i) => (
                <div key={i} className="border-b border-line pb-5 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <StarRatingDisplay average={review.rating} count={1} size={12} />
                    <span className="text-xs text-slate">{review.reviewer_name || "Buyer"}</span>
                  </div>
                  {review.comment && <p className="text-sm text-slate leading-relaxed">{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-paper p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-ink border border-line font-display font-bold text-sm">
              {(gig.seller_profiles?.display_name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{gig.seller_profiles?.display_name}</p>
              {verified && <p className="text-xs text-ember">Verified seller</p>}
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-line pt-5 mb-6">
            <span className="text-sm text-slate">Price</span>
            <span className="font-mono text-xl">₦{gig.price_ngn.toLocaleString()}</span>
          </div>

          {isOwnGig ? (
            <div className="space-y-3">
              <p className="text-xs text-slate text-center">
                This is your product. <Link href="/gigs/mine" className="text-ember hover:underline">Manage it</Link>
              </p>
              <button
                onClick={handleDeleteGig}
                className="w-full rounded-full border border-red-900/20 bg-red-950/10 px-5 py-3 text-sm font-semibold text-red-500 transition-colors hover:border-red-900/40 hover:bg-red-950/20"
              >
                Delete product
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleBuyAndPay}
                disabled={paying}
                className="auth-button w-full"
              >
                {paying ? "Opening secure checkout…" : "Buy now — pay into escrow"}
              </button>
              <button
                onClick={handleMessageSeller}
                disabled={messaging}
                className="w-full rounded-full border border-line px-5 py-3 text-sm font-medium text-bone hover:border-slate transition-colors"
              >
                {messaging ? "Opening…" : "Message seller"}
              </button>
            </div>
          )}
          {actionError && <p className="auth-error mt-4">{actionError}</p>}

          {!isOwnGig && (
            <div className="mt-5 rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[.16em] text-ember">REPORT GIG</p>
                  <p className="mt-2 text-sm text-slate">Send this product to admin for review if it looks unsafe, misleading, or abusive.</p>
                </div>
              </div>
              <label className="mt-4 block text-sm font-medium">
                Reason
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="auth-input mt-2"
                >
                  <option>Spam or misleading content</option>
                  <option>Inappropriate or abusive content</option>
                  <option>Wrong category or pricing</option>
                  <option>Suspicious seller activity</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Details
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="auth-input mt-2 min-h-24"
                  placeholder="Add any extra context for the admin team."
                />
              </label>
              <button
                onClick={handleReportGig}
                disabled={reporting}
                className="mt-4 w-full rounded-full border border-line bg-amber-50 px-5 py-3 text-sm font-semibold text-bone transition-colors hover:border-ember/40 hover:bg-amber-100 disabled:opacity-50"
              >
                {reporting ? "Sending report…" : "Report product"}
              </button>
              {reportSuccess && <p className="mt-3 text-xs text-ember">Thanks. The admin team will review this product.</p>}
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-slate">
            Your payment is held in escrow and only released to the seller once you approve the delivered work.
          </p>
        </aside>
      </section>
    </main>
  );
}
