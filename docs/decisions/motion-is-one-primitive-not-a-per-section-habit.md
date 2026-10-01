# Motion is one primitive, not a per-section habit

**Status:** Accepted · 2026-08-18

## Context

The homepage needed the three sections
[the generator has always listed as missing](../../scripts/build-homepage.mjs) —
Shop the Look, Brand story, Instagram — plus category tiles that actually play
the `tile_clip` metafield. Four new sections, all of them wanting to animate.

The default way that goes is four sections each with their own `@keyframes`,
their own duration, and their own IntersectionObserver. It looks fine in
isolation and reads as four widgets on a page, because the eye is very good at
noticing that one thing eases differently from the thing above it.

There was also a specific risk. Reveal-on-scroll works by hiding content and
then un-hiding it. If the code that un-hides is an asset request — blocked,
offline, mid-deploy — the failure mode is **a blank homepage**, not a homepage
without animation.

## Decision

**One motion vocabulary, in `assets/girlyf-motion.css`, driven by attributes.** A
section animates by writing `data-girlyf-reveal`, `data-girlyf-parallax`,
`data-girlyf-autoplay` or `data-girlyf-rail`. No Girlyf section defines a
keyframe or an easing curve of its own.

| Token | Value | Why |
|---|---|---|
| `--girlyf-ease` | `cubic-bezier(0.16, 0.84, 0.44, 1)` | Eased out, **no overshoot**. The photography is slow natural light on satin; a spring curve fights it |
| `--girlyf-reveal-duration` | 720ms | Horizon's `--animation-speed` is 125ms — that is for controls answering a click. An arrival is not a control |
| `--girlyf-reveal-rise` | 1.75rem | Far enough to read as movement, short enough not to reflow |
| `--girlyf-stagger` | 90ms | Capped at 6 steps in every section, so a ten-tile row is choreographed rather than slow |

**The reveal engine is inline in `<head>`, not an asset.** It owns visibility, so
it must not be able to fail. Inline, the worst case is a page that has already
finished. It also arms the hidden state before first paint, so there is no
flash of laid-out content being hidden and re-shown.

**Everything else is a deferred module** — parallax, clip autoplay, rail
progress. Those are things a page is complete without, so they are allowed to
arrive late or not at all.

**The hidden state is armed by JavaScript, never by CSS alone.** `data-girlyf-motion`
on `<html>` gates every hiding rule, and the engine refuses to set it when
`IntersectionObserver` is missing or the visitor prefers reduced motion.

**Gold is emitted here and nowhere else.** `--girlyf-gold` is defined once, in
`snippets/girlyf-motion.liquid`, from `settings.color_palette.color3`. Horizon's
own `color-palette.liquid` publishes only `background` and `foreground` as CSS
variables, so a section wanting the accent has exactly one source — which makes
the guidelines' 10% law greppable rather than a matter of trust. See
[six-brand-roles-onto-four-horizon-slots](six-brand-roles-onto-four-horizon-slots.md).

## Consequences

- **`girlyf-category-tiles` replaces Horizon's `collection-list` on the
  homepage.** Not for the animation — because `custom.tile_clip` is a *pinned*
  metafield that `collection-list` cannot render. Until now it was a box in the
  admin the team could fill and then watch do nothing, which is worse than not
  offering it. The clip is a substitute for the tile image, so the fallback runs
  clip → collection image → first product's image → placeholder.
- **Reduced motion is not a fallback path, it is the absence of one.** Every
  moving rule sits inside `prefers-reduced-motion: no-preference`, so a visitor
  who has turned motion down gets the finished layout with no second
  implementation to keep in step.
- **A reveal is one-way.** An element that has arrived is unobserved and never
  re-hidden. Re-animating on every pass is a distraction the second time and
  nausea the tenth.
- **Two schema rules cost a build each, and neither is caught by
  `shopify theme check`:**
  1. A `url` setting **cannot carry a `default`**. Give it one and Shopify
     rejects the entire section file. The Instagram profile link therefore lives
     as a value in `templates/index.json`, not as a schema default.
  2. Horizon has **no local blocks.** A section's `blocks` array holds bare
     `{ "type": "..." }` references to files in `blocks/`; declaring a block
     inline with its own `name` and `settings` makes the section fail to
     register. Presets follow the same shape as everywhere else in the theme —
     `blocks` as an object keyed by id, plus `block_order` — never an array.

  Both surface as **"Section type 'x' does not refer to an existing section
  file"**, which points at the template rather than at the schema that actually
  failed, and is why `theme check` passing means very little here. The load-bearing
  check is `shopify theme push --development`: it is the same validator, it runs
  against a throwaway theme, and it cannot touch the live or build themes.
- **`prefers-reduced-motion` and `Save-Data` both suppress clip autoplay**, and
  every clip carries a poster frame, so suppression yields a still photograph
  rather than a black rectangle. That is why the delivery spec's "poster frame
  set" is load-bearing and not hygiene.
- Four sections × one curve means changing the house feel is one line. It also
  means getting it wrong is one line, in a file every section depends on.
- `docs/GLOSSARY.md` gains **Reveal** and **Drift**, because "the animation"
  stopped being specific enough once there were four of them.

## Rejected

**An animation library.** Every one of these effects is a transition on two
properties. A library would be a third-party script on the critical path of the
homepage to avoid writing forty lines of CSS.

**Splitting the brand-story heading into lines in JavaScript.** Measured line
boxes change with the viewport and re-flow mid-animation. The heading is a
textarea and its line breaks are honoured — which for a 56px display serif is
the decision a designer wants to be making anyway.

**An Instagram feed app or embed.** The repo already holds that Instagram is the
*source* of a reel, never its host; the same is true of a still. An embed puts a
third-party script on the homepage, gives up control of crop and loading, and
empties itself when a post is deleted or a token expires. Tiles are uploaded
images with a link to the post — hand-curated, which for nine tiles is the right
trade and lets the grid be art-directed to sit under the brand story.

**Scroll-linked animation via `animation-timeline`.** Genuinely better — no
observer, no rAF — and unsupported in Safari at the time of writing, which is
most of this store's traffic. Worth revisiting; the parallax is the only part
that would change.
