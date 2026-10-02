# GIRLYF — FILL SHEET CONTRACT

> ## The sheet holds words and numbers. Media is always the admin.
>
> No column in this sheet contains a URL, a file name or a Shopify ID. Photographs,
> trust videos and reels are added by Girlyf in the Shopify admin — see
> [`decisions/media-is-added-in-the-admin`](decisions/media-is-added-in-the-admin.md).

**Version:** 0.1.0 · **Last updated:** 2026-08-17
**Companion:** [`GLOSSARY.md`](GLOSSARY.md) for what the words mean.

---

## 1. What this is for

The sheet is how Girlyf add products. It exists so that adding a product cannot
put it in the wrong category, cannot invent a tag, and cannot be forgotten by a
collection.

It is the **launch batch** tool and the tool for any batch over roughly ten
products. Below that the Shopify admin is faster — at the cost of the dropdowns,
so the tag audit is what catches drift there.

**The sheet is only touched when new products launch.** Campaigns, promotions,
price changes, restocks and editorial groupings all happen in the admin. If
changing something would mean re-importing the product, it is a sheet column. If
it is a bulk selection over products that already exist, it is an admin job.

## 2. Columns

**Fifteen columns, all of them typed or picked.** There are no formula columns —
handles, tags and SKUs are derived by the converter, not by the sheet. A filler
cannot break a formula that isn't there, and the derivation rules live in code
where they can be tested.

| Column | Kind | Required | Rule |
|---|---|---|---|
| `Product Name` | text | yes | Short and evocative — "Geo Lariat Necklace", never "Necklace 12" |
| `Category` | dropdown | yes | One of the ten, or `combo`. Never both |
| `Material` | dropdown | yes | `gold-plated` · `oxidised` · `pearl` · `stone` |
| `Material 2` | dropdown | no | For pieces that are genuinely two materials |
| `Size` | dropdown | rings only | `Free Size` · `S` · `M` · `L`. Blank for everything else |
| `Price` | number | yes | INR, no symbol |
| `Compare At` | number | no | The was-price. Puts the product in `Sale` |
| `Stock` | number | yes | Per row — so per size, on a sized ring |
| `Description` | text | yes | Brand tone. Warm, elegant, short. Not a spec sheet |
| `Combo Contains` | text | combos only | The handles of the pieces inside, comma separated |
| `Weight (g)` | number | yes | Grams, piece plus box. The courier bills on this |
| `Pack Size` | dropdown | yes | `pouch` · `small-box` · `bangle-box` · `large-box` |
| `Specs` | multi-pick | yes | The trust facts, comma separated. See below |
| `Photos` | text | yes if Active | File names, comma separated, in the order they should show |
| `Status` | dropdown | yes | `Draft` · `Active`. Defaults to `Draft` |

### The two lists in one cell

`Specs` and `Photos` each hold several values in one cell, comma separated.

`Specs` is the trust block every competitor leads with, and the vocabulary is
fixed: `18k-gold-plated` · `tarnish-free` · `water-resistant` · `hypoallergenic`
· `nickel-free` · `stainless-steel` · `lightweight` · `adjustable`. Tick only
what is true. A shopper reads these as fact.

The description stays **prose**. The specs are a separate field precisely so the
warm sentence is not turned into a spec sheet.

### Photographs: file names, never URLs

Photos are bulk-uploaded once to **Content → Files** in the Shopify admin, and
the sheet holds only the file name. The converter builds the URL, because
Shopify keeps the file name and serves it from a prefix fixed per store.

So there is no CDN to sign up for and no link to paste. Name files
`girlyf-[category]-[product]-[n].jpg`: lower case, hyphens, no spaces, `.jpg`,
because Shopify rewrites anything else and the derived URL would then miss.

A product with three photos is **three rows** in the exported CSV, which is
Shopify's own format. Nobody filling the sheet sees that.

### Derived by the converter, never typed

| Derived | From | Shape |
|---|---|---|
| `Handle` | `Product Name`, slugified | `geo-lariat-necklace` |
| `Image Src` | `Photos` + the store's Files prefix | `https://cdn.shopify.com/.../girlyf-necklaces-geo-lariat-1.jpg` |
| `category` metafield | `Category` | `necklaces` |
| `material` metafield | `Material` + `Material 2` | `["gold-plated","pearl"]` |
| `specs` metafield | `Specs` | `["18k-gold-plated","tarnish-free"]` |
| `SKU` | category + handle + size | `GF-NEC-GEO-LARIAT-NECKLACE-FS` |
| `free_size` metafield | `Size` = `Free Size` | boolean |
| Variant rows | one per `Size` row sharing a name | Shopify's multi-row format |

### The ten categories

`necklaces` · `earrings` · `bracelets-bangles` · `rings` · `anklets` ·
`jhumkas-ethnic-sets` · `hair-accessories` · `waist-chains` · `watches` ·
`keychains-charms`

Fixed by the brand guidelines. Not extensible from the sheet — a new category is a
brand decision, not a data entry decision.

## 3. Sized rings: one row per size

A ring in S, M and L is **three rows** sharing one `Product Name`. Same name, same
price, same description; different `Size` and `Stock`.

| Product Name | Category | Size | Price | Stock |
|---|---|---|---|---|
| Clover Stacking Ring | rings | S | 449 | 6 |
| Clover Stacking Ring | rings | M | 449 | 6 |
| Clover Stacking Ring | rings | L | 449 | 6 |

A ring that is adjustable is **one row** with `Size` = `Free Size`. The converter
turns that into a single-variant product with no size selector, plus a `free_size`
metafield the theme renders as a badge. Nobody filling the sheet needs to know that
happened.

Nothing except rings uses `Size`.

## 4. Combos

A combo has `Category` = `combo`, and gets the `combo` tag instead of a category
tag — so it never appears on a category page competing with the very pieces it
contains.

`Combo Contains` holds the **handles** of those pieces. The converter cannot turn
handles into Shopify's internal references, so the `combo_items` metafield is
linked in the admin afterwards, once. It is the one field the sheet describes but
does not deliver.

Set `Compare At` to the sum of the parts, or the saving is invisible.

## 5. Rules that are not obvious

**Never rename a live product in the sheet.** `Handle` is derived from
`Product Name`, and the handle is the product's identity — its URL, and what its
media hangs off. Renaming in the sheet produces a *second* product, not a renamed
one. To change a display name, change the title in the Shopify admin: that leaves
the handle alone, which is exactly what you want.

**`Status` defaults to `Draft`.** A product goes Active when it has photographs.
This is the same discipline as the collection publication gate, one level down.

**Stock is per row.** On a sized ring, three rows means three independent stock
numbers, and they drift independently — which is the point.

**Blank is not zero.** A blank `Stock` is a missing answer and fails validation. A
product genuinely out of stock is `0`.

## 6. What the sheet deliberately cannot do

| Not in the sheet | Where it lives |
|---|---|
| Photographs, trust video, reels | Shopify admin, per product |
| Category tile clips | Shopify admin, on the collection |
| `combo_items` links | Shopify admin, once per combo |
| Seasonal and campaign tags (`edit:*`) | Shopify admin, bulk tag editor |
| The photographs themselves | Shopify admin, Content → Files, bulk drag |
| New categories | The brand guidelines |
| Discounts, COD rules, shipping | Shopify admin |

Each of those is a deliberate exclusion, not a gap. A sheet that could do all of
them would need a URL column, an ID column and a free-text tag column — and those
three columns are where a spreadsheet-driven catalogue goes wrong.
