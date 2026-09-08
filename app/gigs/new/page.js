'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import SiteHeader from '@/components/SiteHeader';

const CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'writing', label: 'Writing' },
  { value: 'ai_assisted', label: 'AI-assisted' },
];

// Gate states, in order of precedence:
//   checking  — waiting on auth + seller_profiles lookup
//   signedOut — no session at all
//   noProfile — signed in, never started seller onboarding
//   pending   — seller_profiles exists, verification_status !== 'approved'
//   ready     — approved seller, show the form
export default function NewGigPage() {
  const router = useRouter();
  const [gate, setGate] = useState('checking');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('development');
  const [price, setPrice] = useState('');
  const [isAiAssisted, setIsAiAssisted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setGate('signedOut'); return; }

      const { data: profile, error: profileError } = await supabase
        .from('seller_profiles')
        .select('verification_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError || !profile) { setGate('noProfile'); return; }
      if (profile.verification_status !== 'approved') { setGate('pending'); return; }
      setGate('ready');
    }

    checkAccess();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const priceValue = Number(price);
    if (!priceValue || priceValue <= 0) { setError('Enter a price greater than ₦0.'); return; }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Your session expired — please sign in again.'); setSubmitting(false); return; }

    const { data: sellerProfile, error: profileError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !sellerProfile) {
      setError('We could not load your seller profile. Please try again.');
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('gigs').insert({
      seller_id: sellerProfile.id,
      title,
      description,
      category,
      price_ngn: priceValue,
      is_ai_assisted: isAiAssisted,
      status: 'pending_review',
    });

    if (insertError) { setError(insertError.message); setSubmitting(false); return; }
    setSuccess(true);
    setSubmitting(false);
  }

  if (gate === 'checking') {
    return (
      <main className="min-h-screen bg-ink text-bone grid place-items-center px-6">
        <p className="text-sm text-slate">Checking your account…</p>
      </main>
    );
  }

  if (gate === 'signedOut') {
    return (
      <GateMessage
        eyebrow="SIGN IN REQUIRED"
        title="Sign in to list a product."
        body="You'll need an account before you can publish work on The Middleman."
        actionHref="/signup?mode=signin"
        actionLabel="Sign in or create an account"
      />
    );
  }

  if (gate === 'noProfile') {
    return (
      <GateMessage
        eyebrow="SELLER VERIFICATION"
        title="Complete seller verification first."
        body="Listing a product requires an approved seller profile — it only takes a few minutes to submit."
        actionHref="/onboarding/role"
        actionLabel="Start seller verification"
      />
    );
  }

  if (gate === 'pending') {
    return (
      <GateMessage
        eyebrow="UNDER REVIEW"
        title="Your seller profile is still being reviewed."
        body="A member of our team reviews every application by hand. Once you're approved, you'll be able to publish products from this page."
        actionHref="/onboarding/pending"
        actionLabel="Check verification status"
      />
    );
  }

  if (success) {
    return (
      <GateMessage
        eyebrow="SUBMITTED FOR REVIEW"
        title="Your product is under review."
        body="Our team reviews every new product before it goes live. You'll be notified once it's approved and visible in the marketplace."
        actionHref="/gigs/mine"
        actionLabel="View my products"
      />
    );
  }

  return (
    <main className="min-h-screen bg-ink text-bone">
      <SiteHeader isSeller />

      <section className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-xs font-semibold tracking-[.2em] text-ember">LIST A PRODUCT</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Describe the product you&apos;re selling.</h1>
        <p className="mt-3 text-sm text-slate">This publishes immediately once you submit.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-line bg-paper p-6 sm:p-8">
          <label className="block text-sm font-medium">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="auth-input mt-2"
              placeholder="e.g. Custom inventory dashboard build"
            />
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              required
              minLength={20}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="auth-input mt-2 min-h-32"
              placeholder="What's included, your process, and what the buyer receives."
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="auth-input mt-2">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Price (₦)
              <input
                required
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="auth-input mt-2"
                placeholder="35000"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate">
            <input
              type="checkbox"
              checked={isAiAssisted}
              onChange={(e) => setIsAiAssisted(e.target.checked)}
              className="h-4 w-4"
            />
            This product involves AI-assisted work — buyers will see this labelled clearly.
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button disabled={submitting} className="auth-button w-full sm:w-auto sm:px-7">
            {submitting ? 'Publishing…' : 'Publish product'}
          </button>
        </form>
      </section>
    </main>
  );
}

function GateMessage({ eyebrow, title, body, actionHref, actionLabel }) {
  return (
    <main className="min-h-screen bg-ink text-bone grid place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-8 text-center">
        <p className="text-xs font-semibold tracking-[.2em] text-ember">{eyebrow}</p>
        <h1 className="mt-3 font-display text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate">{body}</p>
        <Link href={actionHref} className="mt-6 inline-flex rounded-full bg-ember px-6 py-3 text-sm font-medium text-ink hover:bg-ember/90 transition-colors">
          {actionLabel}
        </Link>
      </div>
    </main>
  );
}
