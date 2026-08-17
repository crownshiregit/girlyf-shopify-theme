# Best Sellers is a homepage row, not a collection

**Status:** Accepted · 2026-08-17
**Corrects** the claim in
[categories-created-before-they-are-published](categories-created-before-they-are-published.md)
that Best Sellers could be "automated from Shopify's own sales ordering". That is
true of sorting and false of selection.

## Context

Shopify automated collections have **no best-selling condition**. Sales rank is a
*sort* order, not a rule you can match on. So an automated "Best Sellers"
collection matching everything and sorted by sales is the entire catalogue in
popularity order — which is not a Best Sellers page, however it is labelled.

The same is true of Newly Launched: publish date orders products, it does not
select them.

This matters because Best Sellers is the collection most likely to be
hand-curated, and hand-curated collections go stale. Girlyf is a running business
with real sales data; a stale manual list would be worse than no list.

## Decision

**Best Sellers and Newly Launched are homepage sections, not collections.** Each
shows the top N products by its sort — sales rank, publish date — and updates
itself forever with nobody touching it.

**There is no Best Sellers collection page.** Where a browsable equivalent is
wanted, it is **Shop All** with its default sort set to best-selling.

`Under ₹500` and `Sale` remain genuine rule-based collections with real pages —
price and compare-at price are conditions Shopify can actually match.

## Consequences

- The homepage placement is what both source documents actually asked for, so
  nothing is lost.
- **Shop All** doubles as the catch-all a ten-category menu otherwise lacks, and it
  is honestly named — "the whole shop, most popular first" is exactly what it is.
- Nobody can forget to update Best Sellers, because there is nothing to update.
- New sales data improves the homepage automatically. On a store with no order
  history the row will be arbitrary at first; that resolves itself within days of
  real trading, and Girlyf already trade.

## Rejected

**A `bestseller` tag someone maintains.** The exact rot this repo's collection
rules exist to prevent, reintroduced for one collection.

**An automated collection named Best Sellers matching everything, sorted by sales.**
Technically automatic, and it lies — the page contains the worst sellers too, at
the bottom.
