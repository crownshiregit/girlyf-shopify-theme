# The brand guidelines supersede the build checklist

**Status:** Accepted · 2026-08-17

## Context

Two documents describe this build. The **build & handover checklist** was written
first, from competitor research. The **Girlyf Brand & Visual Guidelines v1.0**
were authored afterwards and are the actual brand system.

They disagree in four places, and the checklist is wrong in all four. Anyone
reading the checklist alone will build the wrong store.

## Decision

Where the two conflict, **the guidelines win**.

| Subject | Checklist says | Guidelines say — and this is what we build |
|---|---|---|
| Display font | Aristotelica Pro Display | **Bodoni Moda**, weights 500–700 |
| Body font | Inter / Assistant | **Poppins**, weights 400–600 only |
| Palette | 4 colours | **6 named roles** + a 60/30/10 usage law |
| Taxonomy | 7 categories | **10 categories**, adding Jhumkas / Ethnic Sets, Watches, Keychains / Charms |
| Navigation | `Home \| Shop (mega-menu) \| New Arrivals \| Combos \| About \| Contact` | Flat category nav plus **Sale** |

## Consequences

- **No custom font upload.** Bodoni Moda and Poppins are both Google fonts, so
  this is a theme-settings pick, not an `@font-face` exercise. The checklist's
  "load Aristotelica via custom font upload" step is deleted. If Bodoni Moda
  turns out to be absent from the store's font picker, it becomes a webfont in
  `assets/` — verify before assuming.
- **`#F2E8DA` is not a Girlyf colour.** It is the most frequent hex in the
  guidelines HTML file, because it is that page's own furniture. It must never
  reach the theme.
- Gold `#C6A15B` on Cream `#E7D9C4` is the contrast pairing most likely to fail
  WCAG AA. The 60/30/10 law already forbids gold carrying structural weight;
  a contrast check should enforce that it never carries body text either.
- The checklist stays useful for everything the guidelines are silent on:
  apps, payments, checkout, QA, the migration sequence.

## Rejected

**Treating the checklist as the spec and the guidelines as inspiration.** It is
the wrong way round — one is a research memo, the other is a versioned brand
system with named tokens and a usage law.
