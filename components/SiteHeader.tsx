'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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
    router.push('/signup?mode=signin');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:py-5">
        <Link href="/" className="font-display font-bold text-lg tracking-tight flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_0_6px_rgba(242,100,25,.12)]" />
          The Middleman
        </Link>
        <div className="flex items-center gap-2 text-sm text-slate">
          <div className="flex items-center gap-1 rounded-full border border-line bg-white/80 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-ember/8 hover:text-bone"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => router.forward()}
              aria-label="Go forward"
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-ember/8 hover:text-bone"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <nav className="flex items-center gap-2 text-sm text-slate">
          <Link href="/marketplace" className="rounded-full px-3 py-2 transition-colors hover:bg-ember/8 hover:text-bone">Marketplace</Link>
          <Link href="/orders" className="rounded-full px-3 py-2 transition-colors hover:bg-ember/8 hover:text-bone">My Orders</Link>
          {isSeller && <Link href="/gigs/mine" className="rounded-full px-3 py-2 transition-colors hover:bg-ember/8 hover:text-bone">My Products</Link>}
          <Link href="/messages" className="rounded-full px-3 py-2 transition-colors hover:bg-ember/8 hover:text-bone">
            <span className="inline-flex items-center gap-2">
              Messages
              {unreadCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ember px-1.5 py-0.5 text-[11px] font-semibold leading-none text-ink">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </Link>
          <Link href="/payments" className="rounded-full px-3 py-2 transition-colors hover:bg-ember/8 hover:text-bone">Payments</Link>
          <Link href="/profile" className="rounded-full px-3 py-2 transition-colors hover:bg-ember/8 hover:text-bone">Profile</Link>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-slate shadow-sm transition-colors hover:border-ember/40 hover:text-ember"
          >
            Sign out
          </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
