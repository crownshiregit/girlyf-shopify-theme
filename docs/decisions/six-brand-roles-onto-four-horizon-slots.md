# Six brand roles onto Horizon's four palette slots

**Status:** Accepted · 2026-08-17
**Resolves** the mapping left open by
[theme-base-follows-the-store](theme-base-follows-the-store.md).

## Context

The store shipped **Horizon 4.1.4**, live and the only theme — exactly what that
decision predicted, and what makes Dawn a non-starter.

Horizon derives its whole look from a `color_palette` setting with four slots. As
shipped: `background` `#ffffff`, `foreground` `#000000`, `color1` `#333333`,
`color2` `#DFDFDF`. There are **191 references to those four slots** across
`blocks/`, `sections/` and `config/`, and only two literal colours anywhere in
settings. It is a genuine token primitive.

The Girlyf guidelines publish **six** named roles. Four slots, six roles.

### Measured contrast, before deciding anything

| Ink | on Paper `#FDFAF5` | on Cream `#E7D9C4` | Verdict |
|---|---|---|---|
| Espresso `#3E160B` | 15.23 | 11.42 | AA body text |
| Ink `#30261F` | 14.18 | 10.63 | AA body text |
| Cocoa `#61493D` | 7.98 | 5.98 | AA body text |
| **Gold `#C6A15B`** | **2.33** | **1.75** | **Fails even large text** |

Three findings drove the decision:

1. **Gold cannot carry text.** The guidelines say "gold, sparingly: CTAs, prices,
   dividers, icons". At 1.75:1 a price on a cream card is close to unreadable.
   Gold *can* hold Espresso text on it (6.53), so gold is a **fill, never an ink**.
2. **Espresso and Ink are perceptually the same** — 15.23 against 14.18. A second
   near-black would consume a slot that a ground genuinely needs.
3. **Cream on Paper is 1.33.** Cards are almost indistinguishable from the page by
   fill alone, so a card needs a border or shadow to exist.

## Decision

| Horizon slot | Girlyf role | Hex | Drives |
|---|---|---|---|
| `background` | **Paper** | `#FDFAF5` | Page, drawers, popovers, inputs, quick-add, sale badge, primary-button *label* |
| `foreground` | **Espresso** | `#3E160B` | All text, primary button, selected variant, secondary-button text and border |
| `color1` | **Cream** | `#E7D9C4` | Section and card grounds, sold-out badge |
| `color2` | **Cocoa** | `#61493D` | Borders and dividers — drawer, input, variant, popover |
| `color3` *(added)* | **Gold** | `#C6A15B` | The 10% accent. Fills and marks only, in Girlyf-authored code |

**Ink `#30261F` is dropped.** Espresso absorbs it. A one-point contrast difference
does not earn a slot.

**`color1` stopped meaning "input text".** All four of Horizon's `color1` uses were
input text — putting Cream there would have made every form field invisible. Those
now point at `foreground`, in `config/settings_data.json`, `sections/footer-group.json`
and `templates/password.json`.

**`badge_sold_out_background_color` was the one real literal** (`#eef1ea`) and now
references `color1`. The remaining literal, `palette_secondary_button_background:
rgba(0,0,0,0)`, is transparency rather than a colour and stays.

### Typography

Bodoni Moda for display, Poppins for body, per the guidelines:

| Setting | Value |
|---|---|
| `type_heading_font` | `bodoni_moda_n6` |
| `type_subheading_font` | `poppins_n5` |
| `type_body_font` | `poppins_n4` |
| `type_accent_font` | `poppins_n6` |

Sizes mapped onto the guidelines' five stated tiers — H1 40–72, H2 28–36, H3/Label
16–18, Body 14–16, Eyebrow 11–12: `h1` 56, `h2` 32, `h3` 18, `h4` 16, `h5` 14,
`h6` 12, paragraph 16.

## Consequences

- **Gold requires Girlyf-authored Liquid.** No vendor Horizon file references
  `color3`, so the accent only appears where we put it. That is a feature: it makes
  the 10% law hard to breach by accident.
- **Cocoa borders are far stronger than Horizon's default** — 7.98 against Paper
  where the shipped `#DFDFDF` on white was 1.32. The guidelines do name Cocoa for
  borders, so this is brand-faithful, but it will read as a heavier interface than
  Horizon's demo and should be looked at on a real page.
- **Cards need a border or shadow**, since a Cream card on a Paper page is a 1.33
  difference. Not optional.
- **Gold must never be the only indicator of anything** — not a divider carrying
  structural meaning, not an icon whose state depends on colour. It fails the 3.0 UI
  threshold on both grounds.
- `h3` 18 and `h4` 16 sit unusually close because the guidelines define five tiers
  and Horizon has six. Faithful to the brand, and worth a designer's pushback.
- Contrast is now checkable: `scripts/lib/brand.mjs` holds the palette and the WCAG
  maths, and is the only place these hexes are written down.

## Rejected

**Ink in a slot, Cream left out.** Two near-blacks and no card ground — the palette
would have had nothing to build a section out of.

**Gold as `color1`.** It would have become input text at 2.33:1, and made the accent
structural in fifteen places, breaking the 10% law by construction.

**Keeping Horizon's `#eef1ea` sold-out badge.** A colour born outside the palette,
in the one place the store admits a product is unavailable.
