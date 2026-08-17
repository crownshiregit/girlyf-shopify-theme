# Media is added in the admin; the filename convention is optional tooling

**Status:** Accepted · 2026-08-17
**Revises** an earlier decision in this file that made a filename-keyed `media:sync`
step the required path. That version created a permanent dependency on us, which
was the wrong trade and is recorded below as rejected.

## Context

Girlyf wants photos, trust video and reels on products, and looping clips on
category tiles. The team adds products through the fill sheet
([the-fill-sheet-is-the-handover-artifact](the-fill-sheet-is-the-handover-artifact.md)).

The earlier reasoning ran: Shopify's product CSV has no video column, and
`Image Src` needs a public URL that a Drive folder cannot provide — therefore
media needs a pipeline, therefore that pipeline is ours, therefore Girlyf depends
on us to publish a photograph.

The last step is where it went wrong. Girlyf are an established business who
should not need their developer to add a picture.

## Decision

**The sheet holds words and numbers. Media is always the admin.**

| Media | Where it goes | How |
|---|---|---|
| Product images | Native product media | Admin uploader |
| Trust video | Native product media, beside the photos | Admin uploader |
| Reels | `list.file_reference` metafield | Admin file picker, **pinned** to the product page |
| Category tile clip | `file_reference` metafield on the collection | Admin file picker, **pinned** to the collection page |

We create the metafield definitions once and pin them, so they appear as ordinary
fields in the admin form. After that, adding a reel is a click.

**The filename convention** — `girlyf-[category]-[product]-[sequence].[ext]` —
remains **recommended** for SEO and file hygiene, and a bulk importer keyed on it
is worth running **once**, for the launch migration, when a few hundred files need
placing at once. It is optional tooling, not a contract. Nothing in the store
depends on a file being named correctly.

## Consequences

- The `Image Src` public-URL problem disappears, because the CSV carries no media.
- After handover, **the only thing needing us is theme code.** Products, media,
  video, categories, campaigns, collections, discounts: all Girlyf's, all in the
  admin.
- Metafield definitions must be **pinned**, or they are invisible in the admin
  form and the team will reasonably conclude reels are impossible.
- Video still obeys the guidelines' delivery spec — MP4 H.264 or WebM, under 8MB,
  no audio track, poster frame — but that is now a content instruction in the
  handover doc, not something a script enforces.
- A product added in the admin rather than the sheet **loses the dropdown
  guarantee.** The admin offers tag autocomplete, not a locked list, so
  `category:earrings` is suggested but `earings` is not prevented. The sheet earns
  its keep on the launch batch and on any batch over ~10; a periodic tag audit
  catches drift below that.

## Rejected

**A required `media:sync` step keyed on filename, run by us.** Enables bulk
placement and per-file validation, and makes Girlyf dependent on a developer to
publish a photograph. That is a worse store to hand over, whatever it does for
data hygiene. Kept as optional migration tooling instead.

**Homepage-only video, so no media question arises.** Rejected earlier and still
rejected: Girlyf want trust video on the product detail page.
