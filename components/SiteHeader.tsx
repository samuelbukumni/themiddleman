'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

type ConversationUnreadRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  buyer_last_read_at: string | null;
  seller_last_read_at: string | null;
  messages: { sender_id: string; created_at: string }[] | null;
};

export default function SiteHeader({ isSeller = false }: { isSeller?: boolean }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setUnreadCount(0);
        return;
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('id, buyer_id, seller_id, buyer_last_read_at, seller_last_read_at, messages ( sender_id, created_at )')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (cancelled) return;

      if (error) {
        setUnreadCount(0);
        return;
      }

      const conversations = (data ?? []) as ConversationUnreadRow[];

      const count = conversations.reduce((total, conversation) => {
        const isBuyer = conversation.buyer_id === user.id;
        const lastReadAt = isBuyer ? conversation.buyer_last_read_at : conversation.seller_last_read_at;
        const latestIncomingMessage = (conversation.messages ?? [])
          .filter((message) => message.sender_id !== user.id)
          .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0];

        if (!latestIncomingMessage) return total;
        if (!lastReadAt) return total + 1;
        return new Date(latestIncomingMessage.created_at) > new Date(lastReadAt) ? total + 1 : total;
      }, 0);

      setUnreadCount(count);
    }

    loadUnreadCount();

    const handleRefresh = () => {
      void loadUnreadCount();
    };

    window.addEventListener('messages:read-updated', handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('messages:read-updated', handleRefresh);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/signup?mode=signin');
  }

  const desktopLink = 'rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-ember/10 hover:text-bone';
  const mobileLink = 'flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium text-bone transition-colors hover:bg-ember/10 active:bg-ember/15 min-h-[44px]';

  const unreadBadge = unreadCount > 0 && (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ember px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-xs">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-xl shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Logo className="text-lg" markClass="h-7 w-7" />

        {/* Desktop nav — md and above */}
        <div className="hidden md:flex items-center gap-3 text-sm text-slate">
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/marketplace" className={desktopLink}>Marketplace</Link>
            <Link href="/orders" className={desktopLink}>My Orders</Link>
            {isSeller && <Link href="/gigs/mine" className={desktopLink}>My Products</Link>}
            <Link href="/messages" className={desktopLink}>
              <span className="inline-flex items-center gap-2">
                Messages
                {unreadBadge}
              </span>
            </Link>
            <Link href="/payments" className={desktopLink}>Payments</Link>
            <Link href="/profile" className={desktopLink}>Profile</Link>
          </nav>
          <button
            onClick={handleSignOut}
            className="hidden md:inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-slate shadow-2xs transition-all hover:border-ember/40 hover:text-ember hover:shadow-xs active:scale-98"
          >
            Sign out
          </button>
        </div>

        {/* Mobile actions — below md */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/messages"
            aria-label="Messages"
            className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 text-sm font-medium text-slate shadow-2xs transition-colors hover:text-bone active:bg-ember/10"
          >
            <span className="inline-flex items-center gap-1.5">
              Messages
              {unreadBadge}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/80 text-slate shadow-2xs transition-colors hover:text-bone active:bg-ember/10"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu sheet */}
      {menuOpen && (
        <div className="border-t border-line bg-white/98 backdrop-blur-xl md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            <Link href="/marketplace" onClick={() => setMenuOpen(false)} className={mobileLink}>
              <span>Marketplace</span>
              <svg className="h-4 w-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/orders" onClick={() => setMenuOpen(false)} className={mobileLink}>
              <span>My Orders</span>
              <svg className="h-4 w-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            </Link>
            {isSeller && (
              <Link href="/gigs/mine" onClick={() => setMenuOpen(false)} className={mobileLink}>
                <span>My Products</span>
                <svg className="h-4 w-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
              </Link>
            )}
            <Link href="/payments" onClick={() => setMenuOpen(false)} className={mobileLink}>
              <span>Payments</span>
              <svg className="h-4 w-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/profile" onClick={() => setMenuOpen(false)} className={mobileLink}>
              <span>Profile</span>
              <svg className="h-4 w-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            </Link>
            <button
              onClick={handleSignOut}
              className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate transition-colors hover:border-ember/40 hover:text-ember active:bg-ember/10"
            >
              Sign out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
