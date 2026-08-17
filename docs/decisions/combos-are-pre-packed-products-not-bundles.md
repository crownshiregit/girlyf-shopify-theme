# Combos are pre-packed products, not bundles

**Status:** Accepted · 2026-08-17

## Context

The build checklist calls combos the headline AOV lever — a 2-piece combo priced
₹100–150 under the sum of its parts. The brand guidelines never mention combos,
and push "Stack & Layer", "The Layering Edit" and "Explore Sets" instead.

They disagree because **three different things were being called one word**:

1. A **set** that is physically one item — a jhumka with its matching maang tikka,
   shot and sold together.
2. A **fixed combo** — two named pieces at a combo price.
3. A **flexible combo** — a price break for buying any two of something, where the
   customer picks the pair.

## Decision

| Thing | Modelled as |
|---|---|
| Ethnic set | An ordinary product in category Jhumkas / Ethnic Sets. No combo machinery |
| Fixed combo | A product with a `combo` tag and a `combo_items` (`list.product_reference`) metafield |
| ~~Flexible combo~~ | **Not built.** See below |

**Flexible combos are not built.** The "any 2 pieces, ₹150 off" automatic discount
depended on the checklist's flat ₹100–150-under-the-sum figure. Girlyf price each
combo on its own merits, so there is no rule to encode — a blanket discount would
either undercut the pre-packed combos or contradict them. Combos are therefore
**only** pre-packed products, each with its own price.

**Fixed combos are pre-packed.** Girlyf assembles combo boxes up front, and the
count of boxes is what Shopify holds.

**A combo carries no category tag.** Every product carries *either* exactly one
`category:` tag *or* the `combo` tag — never both, and CI checks it.

## Consequences

- Pre-packing makes the combo's stock number **correct by construction**: the combo
  genuinely is a separate physical object on a shelf, so an independent inventory
  number is accurate rather than a latent oversell.
- It also makes the product better. The checklist calls the collection "Combos /
  Gift Sets", and a gift that arrives as two loose pieces in a poly mailer is not
  one. The cheap architecture is here also the right one.
- Combos stay inside the fill sheet. No second workflow for the client's team.
- `combo_items` lets the product page state what is inside and link to each piece,
  so a combo is not a mystery box with a photo.
- Combos do not appear on category pages, so they never compete with the very
  pieces they contain. The ten-category taxonomy stays exactly as the guidelines
  fixed it, with no eleventh category smuggled in.
- Combo pricing is **per combo**, set in the sheet like any other product's price.
  The ₹100–150-under-the-sum figure was research and is not a rule Girlyf follow.
- Because each combo is priced individually, a combo's saving is only visible if
  its compare-at price is set to the sum of its parts. That is a sheet column, and
  it also puts every combo into the `Sale` collection — which is correct: a combo
  that saves nothing has no reason to exist.

## Rejected

**Shopify's Bundles app.** It derives bundle inventory from components, which
solves pack-time assembly properly. Rejected because **bundle products cannot be
created from a CSV** — combos would leave the sheet entirely and be built by hand
in an app UI, for the part of the catalogue that changes most often. If Girlyf ever
moves to pack-time assembly, combos need this app and should be scoped out of the
handover rather than handing over two workflows.

**A `combo` category as an eleventh entry.** The taxonomy is fixed by the brand
guidelines at ten. A combo is a way of selling, not a kind of jewellery.
