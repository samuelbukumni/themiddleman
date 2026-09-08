'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// These must match the live gig_category enum exactly
const CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'writing', label: 'Writing' },
  { value: 'ai_assisted', label: 'AI-assisted' },
];

// Must match gigs_experience_tier_check: 'beginner' | 'intermediate' | 'expert'
const EXPERIENCE_TIERS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

export default function NewGigPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priceNgn, setPriceNgn] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('7');
  const [experienceTier, setExperienceTier] = useState('beginner');
  const [isAiAssisted, setIsAiAssisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formReady =
    title.trim().length > 0 &&
    description.trim().length >= 30 &&
    category.length > 0 &&
    Number(priceNgn) > 0 &&
    Number(deliveryDays) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formReady) return;

    const price = parseInt(priceNgn, 10);
    const days = parseInt(deliveryDays, 10);

    if (isNaN(price) || price <= 0) { setError('Enter a valid price.'); return; }
    if (isNaN(days) || days <= 0) { setError('Enter a valid delivery time.'); return; }

    setLoading(true);

    // Step 1: get auth user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in.');
      setLoading(false);
      return;
    }

    // Step 2: get seller_profiles.id (NOT user_id — gigs.seller_id FK points to seller_profiles(id))
    const { data: profile, error: profileError } = await supabase
      .from('seller_profiles')
      .select('id, verification_status')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      setError('You need a seller profile before creating a gig. Complete seller onboarding first.');
      setLoading(false);
      return;
    }

    if (profile.verification_status !== 'approved') {
      setError('Your seller account is still under review. You can create gigs once approved.');
      setLoading(false);
      return;
    }

    // Step 3: insert gig — status defaults to 'active' (what the live DB expects)
    const { error: insertError } = await supabase.from('gigs').insert({
      seller_id: profile.id,       // seller_profiles.id — NOT auth user.id
      title: title.trim(),
      description: description.trim(),
      category,                     // must be a valid gig_category enum value
      price_ngn: price,
      delivery_days: days,
      experience_tier: experienceTier,
      is_ai_assisted: isAiAssisted,
      // status omitted — DB defaults to 'active'
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/gigs/mine');
  }

  return (
    <main className="min-h-screen bg-ink text-bone">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-display font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ember" />
            The Middleman
          </Link>
          <Link href="/gigs/mine" className="text-sm text-slate hover:text-bone transition-colors">
            ← My Gigs
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[.16em] text-ember">NEW GIG</p>
          <h1 className="mt-2 font-display text-4xl font-bold">What are you offering?</h1>
          <p className="mt-3 text-sm text-slate">
            Be specific — buyers search by skill, not category. Your gig goes live immediately after you submit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-paper p-6 sm:p-10 space-y-7">

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Gig title
              <span className="ml-2 text-xs font-normal text-slate">What exactly do you deliver?</span>
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. I will build a responsive Next.js landing page"
              className="auth-input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Description
              <span className="ml-2 text-xs font-normal text-slate">Min 30 characters</span>
            </label>
            <textarea
              required
              minLength={30}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe exactly what the buyer gets, what you need from them, and your process."
              className="auth-input w-full min-h-36"
            />
            <p className="mt-1 text-xs text-slate text-right">{description.length} chars</p>
          </div>

          {/* Category + Experience tier */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold mb-2">Category</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="auth-input w-full"
              >
                <option value="" disabled>Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Experience level</label>
              <select
                required
                value={experienceTier}
                onChange={(e) => setExperienceTier(e.target.value)}
                className="auth-input w-full"
              >
                {EXPERIENCE_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price + Delivery */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Price (₦)
                <span className="ml-2 text-xs font-normal text-slate">Naira only</span>
              </label>
              <input
                required
                type="number"
                min="1"
                value={priceNgn}
                onChange={(e) => setPriceNgn(e.target.value)}
                placeholder="e.g. 50000"
                className="auth-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">
                Delivery time
                <span className="ml-2 text-xs font-normal text-slate">In days</span>
              </label>
              <input
                required
                type="number"
                min="1"
                max="90"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="e.g. 7"
                className="auth-input w-full font-mono"
              />
            </div>
          </div>

          {/* AI assisted toggle */}
          <div className="flex items-start gap-3 rounded-xl border border-line bg-ink/40 p-4">
            <input
              id="ai-assisted"
              type="checkbox"
              checked={isAiAssisted}
              onChange={(e) => setIsAiAssisted(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="ai-assisted" className="text-sm cursor-pointer">
              <span className="font-semibold">AI-assisted gig</span>
              <span className="block text-xs text-slate mt-0.5">
                Check this if you use AI tools as part of your delivery. This will be displayed to buyers.
              </span>
            </label>
          </div>

          {error && (
            <p className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate">
              Your gig goes live immediately. You can pause or delete it from My Gigs at any time.
            </p>
            <button
              type="submit"
              disabled={loading || !formReady}
              className="auth-button w-full sm:w-auto sm:px-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Publishing gig...' : 'Publish gig'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
