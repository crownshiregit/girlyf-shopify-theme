// Turns the Girlyf fill sheet into a Shopify product-import CSV.
//
// The contract is docs/FILL_SHEET.md. The rules that matter and why:
//
//   - Rows sharing a Product Name are ONE product with several variants.
//   - `Free Size` is not a variant. It is a single-variant product plus a
//     `free_size` metafield the theme renders as a badge — so a free-size ring
//     never shows a selector with one pointless option in it.
//   - A combo carries the `combo` tag and NO category tag, so it cannot appear on
//     a category page competing with the pieces inside it.
//   - Every tag is namespaced. Nothing here can emit a bare tag.

/** The ten categories, fixed by the brand guidelines. Not extensible from data. */
export const CATEGORIES = {
  necklaces: { title: 'Necklaces', sku: 'NEC' },
  earrings: { title: 'Earrings', sku: 'EAR' },
  'bracelets-bangles': { title: 'Bracelets & Bangles', sku: 'BRA' },
  rings: { title: 'Rings', sku: 'RIN' },
  anklets: { title: 'Anklets', sku: 'ANK' },
  'jhumkas-ethnic-sets': { title: 'Jhumkas / Ethnic Sets', sku: 'JHU' },
  'hair-accessories': { title: 'Hair Accessories', sku: 'HAI' },
  'waist-chains': { title: 'Waist Chains', sku: 'WAI' },
  watches: { title: 'Watches', sku: 'WAT' },
  'keychains-charms': { title: 'Keychains / Charms', sku: 'KEY' },
};

export const MATERIALS = ['gold-plated', 'oxidised', 'pearl', 'stone'];

/**
 * The trust facts, ticked per product and rendered as a list under the prose.
 * Every competitor in this market leads with these; the brand guidelines ask for
 * warm prose instead. A shopper wants both, so the description stays prose and
 * the claims live here, in a vocabulary nobody can retype three different ways.
 */
export const SPECS = [
  '18k-gold-plated', 'tarnish-free', 'water-resistant', 'hypoallergenic',
  'nickel-free', 'stainless-steel', 'lightweight', 'adjustable',
];

/** Which box a piece ships in. The weight itself is Shopify's own field. */
export const PACK_SIZES = ['pouch', 'small-box', 'bangle-box', 'large-box'];

/** Rings are the only category with a size axis. */
export const SIZED_CATEGORY = 'rings';
export const NUMBERED_SIZES = ['S', 'M', 'L'];
export const FREE_SIZE = 'Free Size';

// Lowercase, because that is the vocabulary the STORE uses: it is a value in
// the `custom.category` metafield's choices list and the condition the `combos`
// collection rule matches on. Capitalising it here produced a product that
// validated locally and then matched no collection at all.
export const COMBO = 'combo';
export const VENDOR = 'Girlyf';

/**
 * Shopify's product-import columns, in its own order.
 *
 * NO `Tags` COLUMN. Category and material used to be namespaced tags; they are
 * metafields now, because the admin offers tag autocomplete rather than a fixed
 * list and a mistyped `category:` tag imports cleanly into no collection at all.
 * `edit:*` campaign tags are still a thing, but they are set in the admin in
 * bulk, never here. See decisions/category-is-a-locked-choice-metafield.
 */
export const SHOPIFY_COLUMNS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Type',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Grams',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Status',
  'Metafield: custom.category [single_line_text_field]',
  'Metafield: custom.material [list.single_line_text_field]',
  'Metafield: custom.specs [list.single_line_text_field]',
  'Metafield: custom.pack_size [single_line_text_field]',
  'Metafield: custom.free_size [boolean]',
];

/**
 * Shopify sanitises an uploaded filename and then serves it from a per-store
 * prefix, so a Files URL is derivable from the filename alone — `?v=` is
 * optional, verified against this store. That is what lets the sheet hold a
 * plain filename instead of a 120-character URL, and why no third-party CDN is
 * involved: Shopify re-hosts whatever `Image Src` points at anyway.
 */
export const sanitiseFilename = (name) =>
  name.trim().replace(/\s+/g, '_').replace(/\.jpeg$/i, '.jpg');

export const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** One cell holding several values: trim, drop blanks, keep the typed order. */
export const splitList = (value) =>
  String(value || '').split(',').map((v) => v.trim()).filter(Boolean);

const isPositiveNumber = (v) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0;
const isNonNegativeInteger = (v) => /^\d+$/.test(v) && Number(v) >= 0;

/**
 * Validate the sheet. Returns { errors, warnings } — arrays of
 * { line, column, message }. An empty `errors` array means it will convert.
 */
export const validate = (records) => {
  const errors = [];
  const warnings = [];
  const at = (row, column, message) => ({ line: row._line, column, message });

  if (!records.length) {
    errors.push({ line: 0, column: '', message: 'The sheet has no rows.' });
    return { errors, warnings };
  }

  const byName = new Map();

  for (const row of records) {
    const name = row['Product Name'];
    const category = row.Category;
    const size = row.Size;
    const isCombo = category === COMBO;

    if (!name) {
      errors.push(at(row, 'Product Name', 'Required, and blank.'));
      continue;
    }

    // --- category ---------------------------------------------------------
    if (!category) {
      errors.push(at(row, 'Category', 'Required, and blank.'));
    } else if (!isCombo && !CATEGORIES[category]) {
      errors.push(
        at(
          row,
          'Category',
          `"${category}" is not one of the ten categories or "${COMBO}". ` +
            `Allowed: ${Object.keys(CATEGORIES).join(', ')}, ${COMBO}.`,
        ),
      );
    }

    // --- materials --------------------------------------------------------
    if (!row.Material) {
      errors.push(at(row, 'Material', 'Required, and blank.'));
    } else if (!MATERIALS.includes(row.Material)) {
      errors.push(
        at(row, 'Material', `"${row.Material}" is not one of: ${MATERIALS.join(', ')}.`),
      );
    }
    if (row['Material 2']) {
      if (!MATERIALS.includes(row['Material 2'])) {
        errors.push(
          at(row, 'Material 2', `"${row['Material 2']}" is not one of: ${MATERIALS.join(', ')}.`),
        );
      } else if (row['Material 2'] === row.Material) {
        warnings.push(at(row, 'Material 2', 'Same as Material. It will be ignored.'));
      }
    }

    // --- size: rings only -------------------------------------------------
    if (size) {
      if (category !== SIZED_CATEGORY) {
        errors.push(
          at(row, 'Size', `Only ${SIZED_CATEGORY} have sizes. Leave Size blank for "${category}".`),
        );
      } else if (![...NUMBERED_SIZES, FREE_SIZE].includes(size)) {
        errors.push(
          at(row, 'Size', `"${size}" is not one of: ${NUMBERED_SIZES.join(', ')}, ${FREE_SIZE}.`),
        );
      }
    } else if (category === SIZED_CATEGORY) {
      errors.push(
        at(row, 'Size', `A ring needs a Size — one of ${NUMBERED_SIZES.join(', ')}, or ${FREE_SIZE}.`),
      );
    }

    // --- money ------------------------------------------------------------
    if (!row.Price) errors.push(at(row, 'Price', 'Required, and blank.'));
    else if (!isPositiveNumber(row.Price))
      errors.push(at(row, 'Price', `"${row.Price}" is not a price. Digits only, no ₹ and no commas.`));

    if (row['Compare At']) {
      if (!isPositiveNumber(row['Compare At'])) {
        errors.push(at(row, 'Compare At', `"${row['Compare At']}" is not a price.`));
      } else if (Number(row['Compare At']) <= Number(row.Price)) {
        errors.push(
          at(row, 'Compare At', 'Must be higher than Price — it is the was-price. Leave blank if not on sale.'),
        );
      }
    }

    // --- stock ------------------------------------------------------------
    if (row.Stock === '') {
      errors.push(at(row, 'Stock', 'Required. A blank is a missing answer; genuinely out of stock is 0.'));
    } else if (!isNonNegativeInteger(row.Stock)) {
      errors.push(at(row, 'Stock', `"${row.Stock}" is not a whole number of items.`));
    }

    // --- shipping ---------------------------------------------------------
    // A courier bills on weight. A blank one is not a small parcel, it is an
    // unanswered question that becomes a wrong shipping rate.
    if (!row['Weight (g)']) {
      errors.push(at(row, 'Weight (g)', 'Required, and blank. Grams, of the piece plus its box.'));
    } else if (!isNonNegativeInteger(row['Weight (g)']) || Number(row['Weight (g)']) === 0) {
      errors.push(at(row, 'Weight (g)', `"${row['Weight (g)']}" is not a whole number of grams.`));
    }

    if (!row['Pack Size']) {
      errors.push(at(row, 'Pack Size', 'Required, and blank. Pick the box it ships in.'));
    } else if (!PACK_SIZES.includes(row['Pack Size'])) {
      errors.push(at(row, 'Pack Size', `"${row['Pack Size']}" is not one of: ${PACK_SIZES.join(', ')}.`));
    }

    // --- specs ------------------------------------------------------------
    // These are claims a shopper reads as fact, so an unknown one is an error
    // rather than something to quietly drop.
    for (const spec of splitList(row.Specs)) {
      if (!SPECS.includes(spec)) {
        errors.push(at(row, 'Specs', `"${spec}" is not one of: ${SPECS.join(', ')}.`));
      }
    }
    if (!splitList(row.Specs).length) {
      warnings.push(at(row, 'Specs', 'No specs ticked. Competitors lead with these; a blank list loses the trust copy.'));
    }

    // --- photos -----------------------------------------------------------
    for (const photo of splitList(row.Photos)) {
      if (/[\\/]/.test(photo)) {
        errors.push(at(row, 'Photos', `"${photo}" looks like a path. Use the file name only.`));
      } else if (!/\.(jpg|jpeg|png|webp)$/i.test(photo)) {
        errors.push(at(row, 'Photos', `"${photo}" has no image extension.`));
      }
    }
    if (!splitList(row.Photos).length && row.Status === 'Active') {
      errors.push(at(row, 'Photos', 'An Active product needs photographs. Leave it Draft until it has them.'));
    }

    // --- description, status ---------------------------------------------
    if (!row.Description) errors.push(at(row, 'Description', 'Required, and blank.'));
    if (!['Draft', 'Active'].includes(row.Status)) {
      errors.push(at(row, 'Status', `"${row.Status}" is not Draft or Active.`));
    }

    // --- combos -----------------------------------------------------------
    if (isCombo && !row['Combo Contains']) {
      errors.push(at(row, 'Combo Contains', 'A combo must list the handles of the pieces inside it.'));
    }
    if (!isCombo && row['Combo Contains']) {
      errors.push(at(row, 'Combo Contains', `Only rows with Category "${COMBO}" may list combo contents.`));
    }
    if (isCombo && !row['Compare At']) {
      warnings.push(
        at(row, 'Compare At', 'A combo with no was-price shows no saving. Set it to the sum of the parts.'),
      );
    }

    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(row);
  }

  // --- cross-row checks, per product --------------------------------------
  for (const [name, rows] of byName) {
    const sizes = rows.map((r) => r.Size);

    const duplicates = sizes.filter((s, n) => sizes.indexOf(s) !== n);
    for (const size of new Set(duplicates)) {
      errors.push({
        line: rows.find((r) => r.Size === size)._line,
        column: 'Size',
        message: `"${name}" has two rows for size "${size || '(none)'}".`,
      });
    }

    if (sizes.includes(FREE_SIZE) && sizes.some((s) => NUMBERED_SIZES.includes(s))) {
      errors.push({
        line: rows[0]._line,
        column: 'Size',
        message: `"${name}" mixes ${FREE_SIZE} with numbered sizes. A piece is one or the other.`,
      });
    }

    for (const column of ['Price', 'Description', 'Category', 'Status']) {
      const values = new Set(rows.map((r) => r[column]));
      if (values.size > 1) {
        warnings.push({
          line: rows[1]._line,
          column,
          message: `"${name}" has different ${column} values across its size rows. The first row wins.`,
        });
      }
    }
  }

  return { errors, warnings };
};

/** Materials as the metafield's JSON list. One, or two when genuinely both. */
/** The description is prose. The trust facts are a metafield, not more copy. */
const bodyFor = (row) => `<p>${row.Description}</p>`;

const materialsFor = (row) => {
  const list = [row.Material];
  if (row['Material 2'] && row['Material 2'] !== row.Material) list.push(row['Material 2']);
  return JSON.stringify(list);
};

/** Specs are typed comma-separated in one cell; the metafield wants a JSON list. */
const specsFor = (row) =>
  JSON.stringify(splitList(row.Specs));

/** Photos are filenames, comma-separated, in sheet order. */
const photosFor = (row) => splitList(row.Photos).map(sanitiseFilename);

const skuFor = (row, handle) => {
  const prefix = row.Category === COMBO ? 'CMB' : CATEGORIES[row.Category].sku;
  const body = handle.toUpperCase();
  if (!row.Size) return `GF-${prefix}-${body}`;
  return `GF-${prefix}-${body}-${row.Size === FREE_SIZE ? 'FS' : row.Size}`;
};

/**
 * Convert validated records into Shopify import rows.
 *
 * Shopify's CSV says a product is every consecutive row sharing a Handle, and
 * it reads TWO independent lists down those rows: variants and images. They are
 * not the same length, so a product needs max(variants, images) rows, with each
 * list filled from the top and the rest of the cells blank. A ring in three
 * sizes with one photo is three rows; a necklace with four photos is four.
 *
 * Only the first row carries the product's own fields. Repeat a title on a
 * continuation row and Shopify makes a second product.
 *
 * `cdnPrefix` turns a filename in the sheet into a Files URL. Omit it and the
 * Image Src column comes out empty, which imports fine and leaves the media to
 * be dragged in by hand.
 */
export const toShopifyRows = (records, { cdnPrefix = '' } = {}) => {
  const byHandle = new Map();
  for (const row of records) {
    const handle = slugify(row['Product Name']);
    if (!byHandle.has(handle)) byHandle.set(handle, []);
    byHandle.get(handle).push(row);
  }

  const out = [];

  for (const [handle, rows] of byHandle) {
    const lead = rows[0];
    const sized = rows.some((r) => NUMBERED_SIZES.includes(r.Size));
    const freeSize = lead.Size === FREE_SIZE;

    // Photos are a property of the product, not of a size, so they are read
    // from the lead row only. Three sizes of one ring share its photography.
    const photos = photosFor(lead);
    const span = Math.max(rows.length, photos.length);

    for (let index = 0; index < span; index += 1) {
      const row = rows[index];
      const photo = photos[index];
      const first = index === 0;

      out.push({
        Handle: handle,
        Title: first ? lead['Product Name'] : '',
        'Body (HTML)': first ? bodyFor(lead) : '',
        Vendor: first ? VENDOR : '',
        Type: first ? (lead.Category === COMBO ? 'Combo' : CATEGORIES[lead.Category].title) : '',
        Published: first ? (lead.Status === 'Active' ? 'TRUE' : 'FALSE') : '',

        // Variant columns stop when the variants do. A fourth photo on a
        // single-variant product must not restate the variant, or Shopify
        // reads it as a second one.
        'Option1 Name': row ? (sized ? 'Size' : 'Title') : '',
        'Option1 Value': row ? (sized ? row.Size : 'Default Title') : '',
        'Variant SKU': row ? skuFor(row, handle) : '',
        'Variant Inventory Tracker': row ? 'shopify' : '',
        'Variant Inventory Qty': row ? row.Stock : '',
        'Variant Inventory Policy': row ? 'deny' : '',
        'Variant Fulfillment Service': row ? 'manual' : '',
        'Variant Price': row ? row.Price : '',
        'Variant Compare At Price': row ? row['Compare At'] || '' : '',
        'Variant Requires Shipping': row ? 'TRUE' : '',
        'Variant Taxable': row ? 'TRUE' : '',
        'Variant Grams': row ? lead['Weight (g)'] || '' : '',

        // Image columns stop when the photos do.
        'Image Src': photo ? `${cdnPrefix}${photo}` : '',
        'Image Position': photo ? String(index + 1) : '',
        'Image Alt Text': photo ? lead['Product Name'] : '',

        Status: first ? lead.Status.toLowerCase() : '',

        'Metafield: custom.category [single_line_text_field]': first ? lead.Category : '',
        'Metafield: custom.material [list.single_line_text_field]': first ? materialsFor(lead) : '',
        'Metafield: custom.specs [list.single_line_text_field]': first ? specsFor(lead) : '',
        'Metafield: custom.pack_size [single_line_text_field]': first ? lead['Pack Size'] || '' : '',

        // Only rings answer this question at all.
        'Metafield: custom.free_size [boolean]': first && lead.Category === SIZED_CATEGORY
          ? freeSize ? 'true' : 'false'
          : '',
      });
    }
  }

  return out;
};

/** Combos whose `combo_items` metafield must be linked by hand in the admin. */
export const comboLinks = (records) =>
  records
    .filter((r) => r.Category === COMBO)
    .map((r) => ({
      handle: slugify(r['Product Name']),
      title: r['Product Name'],
      contains: r['Combo Contains'].split(',').map((h) => h.trim()).filter(Boolean),
    }));
