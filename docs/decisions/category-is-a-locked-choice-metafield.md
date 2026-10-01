# Category and material are locked-choice metafields, and the admin is where products are added

**Status:** Accepted · 2026-08-18
**Supersedes** [the-fill-sheet-is-the-handover-artifact](the-fill-sheet-is-the-handover-artifact.md)
as the *primary* entry path. **Revises** the tag namespace in
[tags-are-a-governed-namespace](tags-are-a-governed-namespace.md).

## Context

The store now has its architecture: ten categories, rule-based collections,
pinned metafield definitions, a publication gate. With that in place, the Shopify
admin turns out to be the better place to add a product — variants, photographs,
price and stock are all on one screen, and the owner is already there.

The fill sheet existed for exactly one reason: **a locked dropdown.** Its own ADR
says so, and [media-is-added-in-the-admin](media-is-added-in-the-admin.md) already
recorded the cost of moving away from it — *"a product added in the admin rather
than the sheet loses the dropdown guarantee. The admin offers tag autocomplete,
not a locked list, so `category:earrings` is suggested but `earings` is not
prevented."*

That failure is silent. A mistyped category tag saves without complaint, and the
product appears on no category page, with no error anywhere. Moving entry to the
admin without solving it would trade a real guarantee for convenience.

## Decision

**Category and material become metafields with a `choices` validation, and the
category collections key off the metafield rather than a tag.**

| Field | Type | Choices | Drives |
|---|---|---|---|
| `custom.category` | `single_line_text_field` | the ten, plus `combo` | Category collections |
| `custom.material` | `list.single_line_text_field` | gold-plated, oxidised, pearl, stone | Storefront filters |
| `custom.pack_size` | `single_line_text_field` | pouch, small-box, bangle-box, large-box | Packing and courier rates |

A `choices` validation renders in the admin as a **dropdown**. `earings` is not
typeable. That is the sheet's guarantee, relocated to where the work now happens.

**`combo` is the eleventh choice on `category`, not a separate tag.** The previous
ADR said a product carries exactly one `category:` tag *or* `combo`, never both.
That sentence describes a single-valued enum with eleven values; making it one
means "never both" cannot be expressed wrongly rather than being a rule someone
enforces.

**No `category:` or `material:` tag is written any more.** Two places holding one
fact is how they come to disagree, and only one of them drove anything.

**Weight is Shopify's native per-variant field, in grams.** Not a metafield —
duplicating it would create two answers to one question.

## The capability that makes it work

A metafield definition can only be used in a collection rule if it is created
with `capabilities.smartCollectionCondition.enabled = true`. This is not
discoverable from the schema: `CollectionRuleColumn` accepts
`PRODUCT_METAFIELD_DEFINITION` unconditionally, but the store's own
`collectionRulesConditions` omits it until some definition opts in. Without the
flag, the rule simply cannot be created, and the error reads like a bad rule
rather than a missing opt-in.

`apply.mjs` reports a definition whose capability is off as drift, for that reason.

## Consequences

- **After launch, adding a product is one screen in the admin, forever.** Pick
  Category, pick Material, pick Pack size, type a weight, drag photographs in,
  save. It lands on its category page with nobody tagging anything.
- **Changing a collection rule is a migration**, since Shopify recomputes
  membership on save. `apply.mjs` refuses to do it unless asked with
  `--migrate-rules`, and prints the before and after.
- **Storefront filters must be re-pointed.** `material:*` tags fed them natively;
  a metafield needs Search & Discovery told to expose it. Admin clicks, not code,
  but it is not automatic and the filters are dead until it is done.
- **The fill sheet still derives `category:`/`material:` tags** in
  `scripts/lib/fill-sheet.mjs`, which now produce nothing. Either the converter
  emits metafield columns instead, or the sheet is retired. **Open.**
- A new category is now: one more string in the `choices` list, plus a collection.
  Still not a data-entry decision — the choices live in version control.

## Rejected

**Keeping tags and adding a periodic audit script.** Cheapest, and detects rather
than prevents. The failure it detects is a product invisible in navigation, which
is precisely the failure worth making impossible instead of reportable.

**A Shopify Flow automation mirroring the metafield into a tag**, so existing
rules keep working. Two sources of truth with a moving part between them, handed
to a non-technical owner. When the mirror stops, the two disagree silently.

**Shopify's native Product Category taxonomy.** It is a genuinely locked picker
in the admin and a valid collection rule column. Its tree has no clean node for
"Jhumkas / Ethnic Sets" or "Waist Chains", and the ten are fixed by the brand
guidelines, so the mapping would be lossy and permanent.
