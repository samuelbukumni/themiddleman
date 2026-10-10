# Restored Phase A/B/C payment history

These three SQL files and their original filenames were recovered from
`themiddleman-ng/themiddleman-web`, commit
`05accf30f309aa052444196bf29a91ea721d7759` (`security/audit-hardening`).
They are restored here for the existing database regression tests, alongside the
Phase B order POST endpoint and Phase C signed webhook implementation.

The live project `uwigyojtiudefnwjezhm` was inspected on 2026-09-28. It already has
these migrations, with the following applied versions:

| Phase | Source filename version | Live applied version |
| --- | --- | --- |
| A | 20260917123912 | 20260917123912 |
| B | 20260917124827 | 20260922232033 |
| C | 20260917215825 | 20260922232055 |

**Do not reapply these files to that project or run an automatic migration push.**
This checkout is not a complete baseline or migration history. Later live phases
also exist and are outside this payment repair. No new migration is required for
this change. The older `supabase/schema.sql` is not the live schema.

Confirmed live conventions: `pending_payment` is the unpaid enum value;
`orders.seller_id` and `gigs.seller_id` reference `seller_profiles.id`;
`seller_profiles.user_id` identifies the authenticated seller;
`payments.paystack_reference` is unique, as is `payments.order_id`.
`record_paystack_payment(text,bigint,text)` is a service-role-only, invoker RPC
that locks the order and atomically records payment and advances it to escrow.
