# All ten categories exist from day one; publication is gated

**Status:** Accepted · 2026-08-17

## Context

The brand guidelines fix the taxonomy at **ten categories**: Necklaces,
Earrings, Bracelets & Bangles, Rings, Anklets, Jhumkas / Ethnic Sets, Hair
Accessories, Waist Chains, Watches, Keychains / Charms.

Only **three** have product photography — Necklaces, Earrings, Bracelets &
Bangles. The other seven ship with shoot briefs instead of images.

The build checklist mixed these ten together with Newly Launched, Best Sellers,
Combos and Under ₹500 in a single flat list of "collections". Those four are not
categories. Girlyf is a running business, so Best Sellers in particular is a fact
Shopify can compute from sales, not a list for anyone to maintain.

## Decision

**A category is what a piece is. Ten of them, fixed, one per product.** Each is
an automated collection matching `category:<slug>`.

**Merchandising collections are automated too, and never hand-filled** — Under
₹500 from price, Sale from compare-at price, Newly Launched from publish date,
Best Sellers from Shopify's own sales ordering.

**All ten categories are created immediately. None is published until it has
products and a hero image.** Rules exist from the start, so a product files
itself the instant it is added.

## Consequences

- "Seven categories have no photography" stops being a blocker and becomes a
  queue that drains itself. A shoot lands, the tile image goes on, the category
  publishes. No migration, no re-tagging, no nav surgery.
- The main menu only ever shows what is actually shoppable. A menu link to an
  empty grid reads as a broken store, not a forthcoming one.
- Nobody can hand-curate Best Sellers, forget it, and leave last season on the
  homepage — because there is nothing to curate.
- `category:*` is the only tag that creates category membership, and a product
  carries exactly one. Multi-category products are a filter problem, not a
  membership problem.

## Rejected

**Creating each category only when its photography arrives.** Tidier on day one.
Rejected because it moves the work to the worst possible moment: every future
shoot becomes a collection creation plus a nav edit plus a re-tagging pass,
performed months later by the client's team, correctly.

**Treating Combos, Sale, Under ₹500 and Best Sellers as categories.** Puts
things that change weekly in the same structure as things that never change, and
invites someone to maintain them by hand.
