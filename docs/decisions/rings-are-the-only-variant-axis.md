# Rings are the only variant axis; everything else is single-variant

**Status:** Accepted · 2026-08-17

## Context

Shopify's product CSV expresses variants as **multiple rows sharing a handle**,
with title and description blank on every continuation row. It is the most
error-prone part of that format, and the people filling it are a jewellery team,
not developers. A stray value in a continuation row produces a duplicate product;
a mismatched handle produces a silently wrong variant set.

Girlyf sells a single metal — "everyday gold", "one metal accent" — so there is no
plating or colourway axis, and the guidelines read as ruling one out permanently.
**Rings have sizes: S, M, L.** Nothing else does.

## Decision

**Single-variant by default. A variant axis is an exception that must be argued
for.** Today there is exactly one: `Size` on rings.

**The sheet has one `Size` column, always filled, dropdown-only** — `S`, `M`, `L`,
`Free Size`. The filler's rule has no conditional: every ring row has a Size cell.

**The exporter absorbs the divergence**, not the spreadsheet:

| Sheet says | Exporter emits |
|---|---|
| `Free Size` | Single-variant product (`Title` / `Default Title`) + a `free_size` metafield |
| `S` / `M` / `L` | One CSV row per size, real variants, per-variant inventory |

**The exporter always writes the variant-shaped columns** (`Option1 Name`,
`Option1 Value`) even for single-variant products, using Shopify's own
`Title` / `Default Title` convention. Adding a second axis later is then a matter
of allowing extra rows, not restructuring the export.

**An option is a variant, never a second product.** No "Geo Lariat — Gold" beside
"Geo Lariat — Rose Gold".

## Consequences

- Free-size rings get **no size selector with one pointless option in it**, and
  the person filling the sheet never learns why.
- "Mark adjustable/free-size items clearly" — the checklist's returns-reduction
  ask — is delivered as a **badge driven by the `free_size` metafield**, not as
  words someone remembers to type into a title.
- Per-variant inventory means a sized ring is three stock numbers. A sold-out size
  stays **visible and disabled** with `Notify Me`, rather than vanishing from the
  selector: sold-out is also the popularity signal the checklist wanted.
- **S/M/L share photography**, so media stays attached to the product and no
  variant needs its own image. This only holds while colourway stays off the table
  — a second metal finish would need per-variant images, which is a different and
  more laborious admin job. See
  [media-is-added-in-the-admin](media-is-added-in-the-admin.md).

## Rejected

**A blank `Size` column in the sheet from day one, "ready" for variants.** An
empty column with no rule collects junk — half the rows say "free size", the other
half say "FS" — which is data to clean rather than data to migrate. The column
arrives when the axis is real. It now is, for rings.
