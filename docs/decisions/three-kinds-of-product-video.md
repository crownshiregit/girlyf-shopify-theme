# Three kinds of video, on three different surfaces

**Status:** Accepted · 2026-08-17

## Context

"Support photos, videos, reels, shorts for each category and product" is one
requirement sentence describing several different objects. Modelled as one thing
— a list of videos per product — it produces a product gallery with a styled
vertical marketing clip sitting between two packshots.

Metafield definitions are additive-only in practice: changing a field's type
after products reference it is a migration, not an edit. So this is decided
before the first product, not after forty.

## Decision

| Kind | Shows | Surface |
|---|---|---|
| **Trust video** | The actual item, worn or turning — proof it is real and as photographed | Shopify's **native product media gallery**, beside the photos |
| **Reel** | Styled 9:16 marketing, repurposed from Instagram | `list.file_reference` metafield, rendered in its own strip |
| **Category tile clip** | A 3–5s loop standing in for the category's tile image | `file_reference` metafield on the **collection** |

**Trust video is optional per product.**

**Instagram is the source of a reel, never its host** — reels are re-uploaded MP4s.

## Consequences

- Trust video in native media means the theme's gallery renders it for free. No
  custom gallery code, and every future theme and every Shopify tool expects to
  find product video exactly there.
- Reels being a metafield is not a limitation, it is the point: it keeps them out
  of the gallery, where they would make the product's own imagery incoherent.
- The delivery spec from the guidelines applies to all three — MP4 H.264 or WebM,
  **under 8MB, no audio track, poster frame set**. A muted autoplay loop with an
  audio track is a bigger file for no benefit.
- Because video is muted by default, any message a clip carries must be on-screen
  type. Nothing may depend on sound.
- At 200 products a mandatory trust video would wall the catalogue. Optional plus
  a report of which products lack one lets merchandising prioritise instead.
- Each kind has **one obvious place in the admin** — the media gallery for a trust
  video, a pinned metafield for reels, a pinned collection field for a tile clip —
  so choosing a surface is not a judgement call anyone has to make. The metafields
  must be pinned or they are invisible and the distinction is unusable. See
  [media-is-added-in-the-admin](media-is-added-in-the-admin.md).

## Rejected

**One video list per product.** Fewer definitions, and it throws away the
distinction that makes the gallery coherent. If the trust video and the reel ever
turn out to be the same file in practice, there is only one kind and this model
should be collapsed — but it should be collapsed deliberately, not by accident.

**Instagram embeds instead of uploads.** No poster control, a third-party script
on every product page, and the clip vanishes when the post is deleted.
