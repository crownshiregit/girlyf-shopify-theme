// The Girlyf palette, exactly as the brand guidelines v1.0 publish it.
// Six named roles. This file is the only place these hexes are written down.

export const BRAND = {
  paper: { hex: '#FDFAF5', name: 'Paper', role: 'Page background, product photo mats' },
  cream: { hex: '#E7D9C4', name: 'Cream', role: 'Section backgrounds, cards' },
  espresso: { hex: '#3E160B', name: 'Espresso', role: 'Logo type, headlines, primary buttons' },
  cocoa: { hex: '#61493D', name: 'Cocoa', role: 'Subheads, captions, borders' },
  ink: { hex: '#30261F', name: 'Ink', role: 'Body text on cream/paper' },
  gold: { hex: '#C6A15B', name: 'Gold accent', role: 'Sparingly: CTAs, prices, dividers, icons' },
};

/**
 * The usage law from the guidelines: 60% cream/paper, 30% espresso/cocoa type,
 * 10% gold. Never more than one accent colour per layout. This is why gold may
 * never become a structural colour, whatever the contrast numbers say.
 */
export const USAGE = { grounds: 60, type: 30, accent: 10 };

/** #F2E8DA is the guidelines *document's* own furniture, not a Girlyf colour. */
export const NOT_BRAND = ['#F2E8DA'];

const channel = (hex, at) => parseInt(hex.slice(at, at + 2), 16) / 255;

/** WCAG 2.1 relative luminance. */
export const luminance = (hex) => {
  const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((at) => linear(channel(hex, at)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio, 1–21. */
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** AA thresholds: 4.5 for body text, 3.0 for large text and UI boundaries. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3.0;
