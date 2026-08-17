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
const shippedHero = find('hero');
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

/** 1. Hero — the brand line and the guidelines' own CTA. */
const hero = () => {
  const section = clone(shippedHero);
  eachBlock(section, (_id, block) => {
    if (block.type === 'text') {
      block.settings.text = '<p>Adorn Your Elegance Always</p>';
      block.settings.type_preset = 'h1';
      block.settings.font = 'var(--font-heading--family)';
      block.settings.font_size = '';
    }
    if (block.type === 'button') {
      block.settings.label = 'Shop New In';
      block.settings.link = 'shopify://collections/new-in';
    }
  });
  // Video goes here once Girlyf upload it: media_type_1 = video, video_1 = file.
  // Separate mobile media is what carries the guidelines' 9:16 crop.
  section.settings.media_type_1 = 'image';
  section.settings.custom_mobile_media = true;
  section.settings.media_type_1_mobile = 'image';
  return section;
};

/** 2. Shop by category — all ten tiles, unpublished ones simply do not render. */
const categoryTiles = () => ({
  type: 'collection-list',
  blocks: {
    'static-collection-card': {
      type: '_collection-card',
      name: 't:names.collection_card',
      static: true,
      settings: {
        horizontal_alignment: 'flex-start',
        vertical_alignment: 'flex-end',
        placement: 'on_image',
        border: 'none',
        border_radius: 0,
      },
      blocks: {
        'collection-card-image': {
          type: '_collection-card-image',
          name: 't:names.collection_card_image',
          static: true,
          settings: { image_ratio: 'adapt' },
        },
        'collection-title': {
          type: 'collection-title',
          name: 't:names.collection_title',
          settings: {
            type_preset: 'h6',
            font: 'var(--font-heading--family)',
            alignment: 'left',
            width: 'fit-content',
            background: true,
            // Paper, not Horizon's literal #ffffff. Every colour is a token.
            background_color: '{{ settings.color_palette.background }}',
            'padding-block-start': 4,
            'padding-block-end': 4,
            'padding-inline-start': 8,
            'padding-inline-end': 8,
          },
        },
      },
      block_order: ['collection-title'],
    },
  },
  block_order: [],
  name: 't:names.collection_list',
  settings: {
    collection_list: CATEGORIES,
    layout_type: 'grid',
    columns: 5,
    mobile_columns: '2',
    carousel_on_mobile: true,
    section_width: 'page-width',
    'padding-block-start': 32,
    'padding-block-end': 32,
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
  };
  eachBlock(section, (_id, block) => {
    if (block.type === '_product-list-text' && heading) {
      block.settings.text = `<h3>${heading}</h3>`;
    }
    if (block.type === '_product-list-button' && buttonLabel) {
      block.settings.label = buttonLabel;
    }
  });
  return section;
};

/** 8. Trust strip. */
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
  trust_strip: trustStrip(),
};

// Guidelines' order, minus three sections that need content that does not exist
// yet — see the note printed below.
const order = [
  'hero',
  'shop_by_category',
  'newly_launched',
  'best_sellers',
  'combos',
  'trust_strip',
];

writeFileSync(PATH, `${header}${JSON.stringify({ sections, order }, null, 2)}\n`);

console.log(`\n✓ ${PATH} — ${order.length} sections`);
for (const id of order) console.log(`   ${id.padEnd(20)} ${sections[id].type}`);

console.log('\nNot built, because each needs content that does not exist yet:');
console.log('   Shop the Look (reels)  needs a Girlyf-authored section reading custom.reels');
console.log('   Brand story            needs the 20–30s video');
console.log('   Instagram feed         needs an app block');
console.log('\nHero and category tiles render with placeholder media until Girlyf');
console.log('upload theirs. Hero video: set media_type_1 = video in the editor.\n');
