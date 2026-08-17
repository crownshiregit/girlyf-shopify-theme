# Tags are a governed namespace, and campaigns live in the admin

**Status:** Accepted · 2026-08-17

## Context

New merchandising angles will be wanted on demand — a festive gifting edit, a
price promotion, a "shop the reel" grouping — without a developer being involved
each time.

The tempting reading of "support anything" is to allow free-text tags. That is how
a tag list becomes a landfill: within months there is `earrings`, `Earrings`,
`earring`, `new`, `new-arrival` and `NEW2026`, and no collection rule can be
trusted because nobody knows which spelling is load-bearing.

Unbounded reach is the goal. Unbounded *vocabulary* is the failure.

## Decision

**Every tag is namespaced with a prefix, and un-namespaced tags are rejected in CI.**

| Prefix | Per product | Set where | Drives |
|---|---|---|---|
| `category:<slug>` | exactly one, from the fixed ten | Sheet dropdown | Category collections + nav |
| `combo` | boolean | Sheet | Combos collection |
| `material:<slug>` | one or more — gold-plated, oxidised, pearl, stone | Sheet dropdown | Storefront filters |
| `edit:<slug>` | any number | **Admin, in bulk** | Ad-hoc and editorial collections |

**`edit:<slug>` is the designed-in extension point.** A festive collection is: bulk
tag the products `edit:rakhi-2026`, create an automated collection on that tag, add
it to the menu. No code, no schema change, no migration. Retiring it is
unpublishing the collection.

**A new *namespace* — a new prefix, not a new tag — is a deliberate act**: it goes
on the allowed list, with a line saying what it means. Five minutes, with a paper
trail.

**The split of where tags are set:**

> If changing it would need the product re-importing, it belongs in the **sheet**.
> If it is a bulk selection over products that already exist, it belongs in the
> **admin**.

## Consequences

- The sheet is only touched when **new products launch**. Campaigns, promotions and
  editorial groupings are done by Girlyf in the admin's bulk tag editor, in seconds,
  with no re-import and no developer.
- A tag that merely *describes* rather than *filters* is a metafield in the wrong
  place. `free_size` drives a badge, so it is a metafield, not a tag.
- `material:*` feeds storefront **filters**, never collections — a filter needs no
  collection to exist, and ten categories times four materials would be forty
  collections nobody asked for.
- Products added in the admin rather than the sheet get **autocomplete, not a locked
  list**. `category:earrings` will be suggested once it exists; `earings` will not
  be prevented. A periodic tag audit is the guardrail for small admin-side batches.
- `Under ₹500` and `Sale` need no tag at all — price and compare-at price are
  already facts Shopify holds.

## Rejected

**Free-text tags, "so anything is possible".** Everything is possible and nothing is
reliable. The namespace gives the same reach with a vocabulary that can be checked.

**Driving campaigns from the sheet.** Changing a seasonal tag would mean re-importing
the catalogue, and a free-text campaign column would reintroduce the exact typo class
the category dropdown exists to eliminate.
