#!/usr/bin/env node
// Generates templates/index.json — the homepage — in the guidelines' order.
//
//   npm run homepage:build
//
// WHY A GENERATOR AND NOT A HAND-EDITED FILE
// Horizon's section JSON is deeply nested and depends on `static` blocks whose
// ids the Liquid looks up by name (`content_for 'block', id: 'static-header'`).
// Getting one wrong yields a section that renders empty rather than an error.
// So the known-good structures are CLONED from what Horizon shipped, and only
// the Girlyf-specific values are overridden.
//
// This file is authoritative until Girlyf edit the homepage in the theme editor.
// After that the editor owns it — run `npm run pull` before touching it again,
// or the next push reverts their work.

import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'templates/index.json';
const raw = readFileSync(PATH, 'utf8');
const header = raw.match(/^\s*\/\*[\s\S]*?\*\//)?.[0] ?? '';
const shipped = JSON.parse(raw.slice(header.length));

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Horizon's shipped sections, used as structural templates. */
const find = (type) => {
  const entry = Object.values(shipped.sections).find((s) => s.type === type);
  if (!entry) throw new Error(`No shipped "${type}" section to clone. Re-pull the theme.`);
  return entry;
};
// Only product-list is still cloned. The hero is Girlyf-authored now, so
// looking for a shipped `hero` here would throw the moment this generator has
// run once — it reads back the file it just wrote.
const shippedProductList = find('product-list');

/** Walk every nested settings object and apply a mutator. */
const eachBlock = (node, visit) => {
  for (const [id, block] of Object.entries(node.blocks ?? {})) {
    visit(id, block);
    eachBlock(block, visit);
  }
};

// --- the sections -----------------------------------------------------------

const CATEGORIES = [
  'necklaces', 'earrings', 'bracelets-bangles', 'rings', 'anklets',
  'jhumkas-ethnic-sets', 'hair-accessories', 'waist-chains', 'watches',
  'keychains-charms',
];

/**
 * A file uploaded to Shopify Files, referenced the way a template must.
 * `shopify://shop_images/<filename>` is the only form an `image_picker` setting
 * accepts in template JSON — a CDN URL is stored but never resolves.
 */
const shopImage = (filename) => `shopify://shop_images/${filename}`;

/**
 * 1. Hero — Girlyf-authored, not Horizon's.
 *
 * MEASURED, not guessed. Paper type laid over the August 2026 shoot reads
 * 1.7–4.3:1 across a headline — under the 3:1 floor for display type — because
 * the shoot is ivory satin in bright natural light. Clearing 4.5:1 for the
 * eyebrow and button needs ~85% Espresso, which is a wall rather than an
 * overlay. Horizon's hero can only put text ON the media, so on this
 * photography it cannot be made accessible; girlyf-hero puts the words on an
 * Espresso plate at 15.23:1 instead.
 *
 * Horizon's hero also renders its no-image placeholder at natural size, which
 * on an unconfigured store is a screen and a half of illustrated SVG.
 */
const hero = () => ({
  type: 'girlyf-hero',
  blocks: {},
  block_order: [],
  name: 'Girlyf hero',
  settings: {
    image: shopImage('girlyf-home-hero.jpg'),
    eyebrow: 'Fashion ornaments · ₹100–2,000',
    heading: 'Adorn your\nelegance always',
    button_label: 'Shop new in',
    button_link: 'shopify://collections/new-in',
    text_position: 'start',
    height: 85,
    overlay_opacity: 20,
  },
});

/**
 * 2. Shop by category — all ten tiles, unpublished ones simply do not render.
 *
 * Girlyf-authored rather than Horizon's `collection-list`, because the
 * guidelines' category tiles LOOP. `custom.tile_clip` is a pinned metafield on
 * every collection and collection-list renders `collection.image` and nothing
 * else, so on the shipped section that field is a box the team can fill and then
 * watch do nothing.
 */
const categoryTiles = () => ({
  type: 'girlyf-category-tiles',
  blocks: {},
  block_order: [],
  name: 'Girlyf category tiles',
  settings: {
    eyebrow: 'The collection',
    heading: 'Shop by category',
    collection_list: CATEGORIES,
    columns: 5,
    mobile_layout: 'rail',
    section_width: 'page-width',
    'padding-block-start': 72,
    'padding-block-end': 72,
  },
});

/**
 * 3–5. Product rows. The shipped heading is `{{ closest.collection.title }}`,
 * so a row names itself from its collection — except Best Sellers, which reads
 * shop-all (sorted BEST_SELLING) and must not be titled "Shop All".
 */
const productRow = ({ collection, maxProducts, heading, buttonLabel }) => {
  const section = clone(shippedProductList);
  section.settings = {
    ...section.settings,
    collection,
    max_products: maxProducts,
    layout_type: 'grid',
    columns: 4,
    mobile_columns: '2',
    carousel_on_mobile: true,
    section_width: 'page-width',
    'padding-block-start': 72,
    'padding-block-end': 72,
  };

  eachBlock(section, (_id, block) => {
    // The row heading is the same object as a Girlyf section heading, so it is
    // set in the same face and size. Left as body type it read as a label on a
    // grid rather than as the start of a section.
    if (block.type === '_product-list-text') {
      if (heading) block.settings.text = `<h3>${heading}</h3>`;
      block.settings.type_preset = 'h2';
      block.settings.font = 'var(--font-heading--family)';
    }

    if (block.type === '_product-list-button' && buttonLabel) {
      block.settings.label = buttonLabel;
    }

    // `adapt` lets every card be a different height, so a row of four sits on
    // four different baselines and the prices never line up. The shoot is
    // portrait throughout, so portrait crops nothing that matters.
    if (block.type === '_product-card-gallery') {
      block.settings.image_ratio = 'portrait';
    }

    // Price in the display face, matching every other number on the page.
    if (block.type === 'price') {
      block.settings.font = 'var(--font-heading--family)';
      block.settings.font_size = '1.0625rem';
    }
  });

  return section;
};

/**
 * 6. Shop the look — the reels strip.
 *
 * Reads `custom.reels` off the products in `new-in`. Renders nothing on the
 * storefront until at least one product has a reel, so it is safe to place in
 * the homepage before any exist.
 */
const shopTheLook = () => ({
  type: 'girlyf-shop-the-look',
  blocks: {},
  block_order: [],
  name: 'Girlyf shop the look',
  settings: {
    eyebrow: 'In motion',
    heading: 'Shop the look',
    description: 'Every piece, worn and turning — the way it looks off the page.',
    collection: 'new-in',
    reels_per_product: 1,
    max_reels: 10,
    'padding-block-start': 80,
    'padding-block-end': 80,
  },
});

/**
 * 7. Brand story.
 *
 * Ships with no media set: the 20–30s brand film is Girlyf's to shoot, and the
 * section falls back to a placeholder rather than blocking the homepage on it.
 * Set the video — or an image — in the theme editor.
 */
const brandStory = () => ({
  type: 'girlyf-brand-story',
  blocks: {},
  block_order: [],
  name: 'Girlyf brand story',
  settings: {
    image: shopImage('girlyf-home-story.jpg'),
    eyebrow: 'Girlyf',
    heading: 'Adorn your\nelegance always',
    body:
      'Ornaments don’t just decorate you — they celebrate you. Gold-plated, ' +
      'tarnish-free, and made for the days you want to feel like yourself only more so.',
    button_label: 'Shop new in',
    button_link: 'shopify://collections/new-in',
    text_position: 'start',
    height: 85,
    overlay_opacity: 15,
  },
});

/**
 * 8. Instagram — uploaded stills, not an embed.
 *
 * Four empty tiles, because a tile is an image Girlyf choose. Empty tiles show a
 * placeholder in the editor and a placeholder on the storefront, which is the
 * same visible prompt the hero already relies on.
 */
const instagram = () => ({
  type: 'girlyf-instagram',
  blocks: Object.fromEntries(
    [1, 2, 3, 4].map((n) => [
      `tile_${n}`,
      {
        type: '_girlyf-instagram-tile',
        name: 'Instagram post',
        settings: {
          image: shopImage(`girlyf-feed-${n}.jpg`),
          post_url: 'https://www.instagram.com/girlyf.in/',
        },
      },
    ])
  ),
  block_order: ['tile_1', 'tile_2', 'tile_3', 'tile_4'],
  name: 'Girlyf Instagram',
  settings: {
    eyebrow: 'Follow',
    heading: '@girlyf.in',
    description: 'Styling, new arrivals and the pieces that sell out first.',
    // A `url` setting takes no default in a schema — Shopify rejects the whole
    // section file, and reports it as the section not existing. So the value
    // lives here, where a URL is legal.
    profile_url: 'https://www.instagram.com/girlyf.in/',
    button_label: 'Follow on Instagram',
    columns: 4,
    image_ratio: '4 / 5',
    section_width: 'page-width',
    'padding-block-start': 80,
    'padding-block-end': 80,
  },
});

/** 9. Trust strip. */
const trustStrip = () => {
  const text = (id, copy) => [id, {
    type: 'text',
    name: 't:names.text',
    settings: {
      text: `<p>${copy}</p>`,
      type_preset: 'custom',
      font: 'var(--font-body--family)',
      font_size: 'var(--font-size--h6)',
      line_height: 'tight',
      letter_spacing: 'normal',
      case: 'none',
      wrap: 'nowrap',
      width: 'fit-content',
    },
    blocks: {},
  }];

  const promises = [
    ['trust_shipping', 'Free shipping on orders above ₹799'],
    ['trust_quality', '18k gold-plated · tarnish-free'],
    ['trust_payment', 'Secure payment'],
    ['trust_whatsapp', 'WhatsApp support'],
    ['trust_line', 'Ornaments don’t just decorate you — they celebrate you'],
  ];

  return {
    type: 'marquee',
    blocks: Object.fromEntries(promises.map(([id, copy]) => text(id, copy))),
    block_order: promises.map(([id]) => id),
    name: 't:names.marquee_section',
    settings: {
      movement_direction: 'left',
      background_color: '{{ settings.color_palette.color1 }}',
      gap_between_elements: 48,
      'padding-block-start': 16,
      'padding-block-end': 16,
    },
  };
};

// --- assemble ---------------------------------------------------------------

const sections = {
  hero: hero(),
  shop_by_category: categoryTiles(),
  newly_launched: productRow({ collection: 'new-in', maxProducts: 8, buttonLabel: 'View all' }),
  best_sellers: productRow({
    collection: 'shop-all', maxProducts: 8,
    heading: 'Best Sellers', buttonLabel: 'Shop all',
  }),
  combos: productRow({ collection: 'combos', maxProducts: 4, buttonLabel: 'All combos' }),
  shop_the_look: shopTheLook(),
  brand_story: brandStory(),
  instagram: instagram(),
  trust_strip: trustStrip(),
};

// The guidelines' order, in full.
//
// Shop the look sits between the product rows and the brand story on purpose:
// it is the first thing on the page that moves at human speed rather than on
// hover, and it lands right where a scroll through four grids starts to flatten.
const order = [
  'hero',
  'shop_by_category',
  'newly_launched',
  'best_sellers',
  'shop_the_look',
  'brand_story',
  'combos',
  'instagram',
  'trust_strip',
];

writeFileSync(PATH, `${header}${JSON.stringify({ sections, order }, null, 2)}\n`);

console.log(`\n✓ ${PATH} — ${order.length} sections`);
for (const id of order) console.log(`   ${id.padEnd(20)} ${sections[id].type}`);

console.log('\nBuilt, but waiting on media Girlyf add in the admin:');
console.log('   hero            set media_type_1 = video in the editor');
console.log('   shop_by_category  a Category tile clip per collection; falls back to the image');
console.log('   shop_the_look   the Reels metafield on any product in new-in — hidden until one exists');
console.log('   brand_story     the 20–30s film, or a still; shows a placeholder meanwhile');
console.log('   instagram       four empty tiles, one image and one post link each\n');
