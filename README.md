# girlyf-shopify-theme

Shopify storefront for **Girlyf** — *Adorn Your Elegance Always*. Fashion
ornaments, ₹100–2,000, currently sold through
[instagram.com/girlyf.in](https://instagram.com/girlyf.in) and WhatsApp.

Built on a Shopify development store and handed over to the Girlyf team, who
populate the catalogue themselves.

> ### ⚠ No theme in this repo yet — that is deliberate.
>
> The theme base is **whatever the dev store ships with**, not a base chosen from
> a plan. New stores in 2026 ship Horizon, and picking Dawn in advance is a
> decision to overwrite the store's own architecture. See
> [`decisions/theme-base-follows-the-store`](docs/decisions/theme-base-follows-the-store.md)
> — the sibling Homingo build paid for this assumption already.

## The shape of it

**Ten categories**, fixed by the brand guidelines, every one an automated
collection on a `category:` tag. All ten exist from day one; each publishes only
once it has products and a hero image — so a product files itself the moment it is
added, and the menu only ever shows what is shoppable.

**Everything else is derived.** `Under ₹500` and `Sale` are price rules. Best
Sellers and Newly Launched are self-updating homepage rows, not collections —
Shopify can *sort* by sales rank but not *select* by it. Seasonal groupings are
`edit:*` tags applied in the admin.

**Girlyf own the catalogue.** After handover the only thing needing a developer is
theme code. Products come in through the fill sheet; photographs, trust videos,
reels, campaigns, discounts and collections are all done in the Shopify admin.

## Commands

Nothing here needs store credentials.

| Command | Does |
|---|---|
| `npm test` | The converter's unit tests |
| `npm run sheet:check` | Validate the fill-sheet template without writing anything |
| `npm run sheet:build <sheet.csv>` | Validate, then write `shopify-import.csv` |

## The fill sheet

[`sheet/girlyf-fill-sheet-template.csv`](sheet/girlyf-fill-sheet-template.csv)
is the artefact the Girlyf team fill in. Eleven columns, all typed or picked from a
dropdown — no formulas, no URLs, no Shopify IDs. Handles, namespaced tags, SKUs,
variant rows and the `free_size` metafield are all derived by
[`scripts/build-import-csv.mjs`](scripts/build-import-csv.mjs), where the rules can
be tested.

**Read [`docs/FILL_SHEET.md`](docs/FILL_SHEET.md) before changing a column.** It is
the contract, and it explains what the sheet deliberately cannot do.

## Conventions

- **Every tag is namespaced** — `category:`, `material:`, `combo`, `edit:`.
  Un-namespaced tags are rejected. A new *prefix* is a deliberate act with a paper
  trail; a new tag inside an existing prefix is free.
- **Every colour and font lives in theme settings, never in code.** Girlyf have a
  real brand system, so this is not about a future swap — it is about the 60/30/10
  usage law staying enforceable.
- **Rings are the only variant axis** (S/M/L/Free Size). Everything else is
  single-variant, and an option is never a second product.
- **The sheet holds words and numbers. Media is always the admin.**

## Open at handover

- Payment gateway KYC — Razorpay or PayU, not yet started. The long pole
- Policy pages, including a published returns position
- WhatsApp Business API and Shopify POS — phase two, both additive
- Photography for seven of the ten categories. Shoot briefs are in the brand
  guidelines

Decisions with reasoning are in [`docs/decisions/`](docs/decisions/); terms are in
[`docs/GLOSSARY.md`](docs/GLOSSARY.md).
