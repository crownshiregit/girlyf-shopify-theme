# The fill sheet is the handover artefact, not a seed script

**Status:** Accepted · 2026-08-17

## Context

Girlyf is an established business selling through Instagram and WhatsApp. They
commissioned a Shopify store; **their team populates the catalogue, not us.** The
deliverable is an architecture plus something they can fill in.

The obvious move was to port
[`homingo-shopify-theme/scripts/shopify-data/`](https://github.com/Crownshire/homingo-shopify-theme):
versioned JSON applied by an idempotent Node runner. It is written, it works, and
it is reviewable in pull requests.

It is also useless here. It requires `npm run data:apply` — a developer — and the
people who will add product number 40 run a jewellery business, not a terminal.
An architecture that only its author can operate has not been handed over.

## Decision

**A validated spreadsheet that exports a Shopify product-import CSV.**

- Category is a **locked dropdown**, never free text.
- The tag column is a **formula**. A human never types a tag.
- The team imports the CSV in the Shopify admin themselves.

**Two categories are built out end-to-end by us** — Necklaces and Earrings, the
ones with photography today — with real products, real prices and real copy, as
the worked example the sheet is filled in against.

## Consequences

- Collections **must** be rule-based on tags. See
  [categories-created-before-they-are-published](categories-created-before-they-are-published.md).
  A locked dropdown that files a product automatically is the entire value; a
  dropdown feeding a collection someone still has to curate by hand is theatre.
- The failure mode of a free-text tag column is *silence* — `earings` imports
  cleanly and the product simply never appears in navigation, with no error
  anywhere. The dropdown exists to make that unrepresentable, not to be tidy.
- **The sheet holds words and numbers only.** Shopify's product CSV has no video
  column, and `Image Src` needs a public URL that a Drive folder is not — so media
  is added in the admin instead, by Girlyf, with no developer involved. See
  [media-is-added-in-the-admin](media-is-added-in-the-admin.md).
- This is explicitly an interim shape. The stated destination is a programmatic
  commerce engine; the sheet is what works while the catalogue is small enough
  to type.

## Rejected

**Versioned JSON plus the Homingo runner.** Validated, diffable, already built.
Rejected because it is not operable by the client, which is the whole
requirement.

**Typing straight into the Shopify admin.** Fine for twenty products. At two
hundred it makes "map each product to the right category" an act of memory
performed two hundred times.
