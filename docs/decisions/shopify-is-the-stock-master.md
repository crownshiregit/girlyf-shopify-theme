# Shopify is the stock master, enforced by software not discipline

**Status:** Accepted · 2026-08-17 — with the enforcement arriving in phase two

## Context

Girlyf is a running business selling through Instagram and WhatsApp **from the
same physical stock** Shopify is about to start selling. Nothing connects them.

The default outcome is an oversell: Shopify says 3, two went out on WhatsApp last
week, a customer buys, and the order is cancelled and refunded. At ₹100–2,000
with Instagram-sourced traffic, a cancellation costs more trust than the order was
worth. Sizes make it worse — three ring sizes drift independently.

The rejected option was manual adjustment after each WhatsApp sale. It requires
someone remembering, every time, forever, and it fails *silently* — nothing in the
store indicates the numbers have drifted.

## Decision

**Every channel writes its orders through Shopify.** WhatsApp orders arrive via a
WhatsApp Business API integration; in-person sales go through Shopify POS. The
decrement is then automatic, because the sale genuinely went through Shopify.

WhatsApp remains the **conversation** channel customers already trust. It stops
being a **second ledger**.

**Both integrations are phase two, explicitly out of the initial handover.** They
are additive: each creates ordinary Shopify orders through Shopify's own APIs, so
neither requires a theme change, a metafield, or a different product model.
Deferring them is a scheduling decision, not an architectural one.

**Until they are live:**

- Inventory tracking is **on**, from launch.
- **One location.**
- A deliberate **buffer** bridges the gap — list slightly under what is held,
  especially on sized rings — and is removed once WhatsApp orders flow through
  Shopify.

## Consequences

- The buffer is a **bridge, not a posture**. It is the only honest use of
  under-listing: it admits to being approximate. Removing it is a phase-two exit
  criterion, not an afterthought.
- `Notify Me` and the sold-out badge only mean something because tracking is on.
  Launching with tracking off would make the store unable to tell a customer the
  truth, and both source documents ask for those states.
- One location keeps the sheet's stock column unambiguous. **Splitting a single
  location later is a genuinely painful migration** — if stock ever sits in two
  places, that must be true in Shopify from the start.
- Phase two belongs in the handover document as a named phase, not left implicit.
  Meta's WABA approval timeline is outside anyone here's control.

## Rejected

**Manual adjustment after WhatsApp sales.** Zero setup, drifts within a fortnight,
and pretends to an accuracy it will not have.

**Not tracking inventory at all.** Nothing oversells because nothing is ever sold
out — at the cost of the sold-out badge, `Notify Me`, and the store's ability to
be truthful.

**A permanent buffer.** Wastes sellable stock forever to avoid an integration that
is already planned.
