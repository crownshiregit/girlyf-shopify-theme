# GIRLYF — GLOSSARY

Terms whose meaning is load-bearing in this repo. Where a word could reasonably
mean two things, this file says which one it means here.

Terms only. No implementation detail, no decisions — those live in
[`decisions/`](decisions/).

---

## The catalogue

**Category** — what a piece *is*: Necklaces, Earrings, Rings. There are exactly
ten, they are fixed by the brand guidelines, and a product carries **exactly
one**. Every category is an automated collection matching `category:<slug>`.
_Avoid_: "collection" on its own, which is ambiguous between this and the next
term.

**Merchandising collection** — a view over the catalogue that changes with
trading, not with what the products are: Newly Launched, Best Sellers, Under
₹500, Sale. Never a category, never hand-filled, always derived from a fact
Shopify already holds (price, publish date, compare-at price, sales rank). If
someone has to remember to add a product to one, it is modelled wrong.

**Fill sheet** — the spreadsheet the Girlyf team fills to add products. The
single interface for text, price, stock and category. It contains no URLs, no
image references and no Shopify IDs. Exports to a Shopify product-import CSV.
_Avoid_: "the CSV" — the CSV is an export artefact, not the thing anyone edits.

**Reference category** — one of the two categories built out end-to-end by us
(Necklaces, Earrings) as the worked example the rest of the catalogue is filled
in against. Its products are real brand copy, never `Test Product 1`.

**Publication gate** — the rule that a category joins the main menu only once it
has products *and* a hero image. All ten categories exist from day one
regardless, so a product files itself the moment it is added and no migration is
ever needed.

## Media

**Asset name** — the recommended filename shape for a media file:
`girlyf-[category]-[product]-[sequence].[ext]`. Good for SEO and for the launch
migration, and deliberately **not** a contract — nothing in the store depends on
a file being named correctly.

**Launch migration** — the one-off bulk placement of the first few hundred media
files, keyed on asset name and run by us. It happens once. Every subsequent
photograph, trust video and reel is added by Girlyf in the admin.
_Avoid_: "media sync", which implies an ongoing process. There isn't one.

**Trust video** — a clip of the actual item, worn or turning, whose job is to
prove the piece is real and as photographed. Lives in the product's **native
media gallery**, beside the photos. Optional per product.
_Avoid_: "product video", which does not say what it is for.

**Reel** — a styled, vertical, marketing clip, usually repurposed from
Instagram. Lives in a metafield and renders in its own strip — deliberately
**not** in the media gallery, where it would sit incoherently between packshots.
A product has any number of them. Instagram is the *source* of a reel, never its
host.

**Category tile clip** — a 3–5s loop standing in for a category's static tile
image. One per category, held on the collection, not on any product.

## Brand

**Paper** `#FDFAF5` — the page ground. **Cream** `#E7D9C4` — sections and cards.
**Espresso** `#3E160B` — headlines and primary buttons. **Cocoa** `#61493D` —
subheads, captions, borders. **Ink** `#30261F` — body text. **Gold** `#C6A15B` —
the single accent: CTAs, prices, dividers, icons.

**The 60/30/10 law** — 60% cream and paper, 30% espresso and cocoa type, 10%
gold. Never more than one accent colour in a layout. From the brand guidelines,
and the reason gold may not become a second structural colour.

**Bag** — what the cart is called in all customer-facing copy.
_Avoid_: "cart" outside code and Shopify's own objects.
