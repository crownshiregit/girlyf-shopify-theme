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

/** Rings are the only category with a size axis. */
export const SIZED_CATEGORY = 'rings';
export const NUMBERED_SIZES = ['S', 'M', 'L'];
export const FREE_SIZE = 'Free Size';

export const COMBO = 'Combo';
export const VENDOR = 'Girlyf';

export const SHOPIFY_COLUMNS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Type',
  'Tags',
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
  'Status',
  'Metafield: custom.free_size [boolean]',
];

export const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

/** Build the namespaced tag list for a row. */
const tagsFor = (row) => {
  const tags = row.Category === COMBO ? ['combo'] : [`category:${row.Category}`];
  tags.push(`material:${row.Material}`);
  if (row['Material 2'] && row['Material 2'] !== row.Material) {
    tags.push(`material:${row['Material 2']}`);
  }
  return tags.join(', ');
};

const skuFor = (row, handle) => {
  const prefix = row.Category === COMBO ? 'CMB' : CATEGORIES[row.Category].sku;
  const body = handle.toUpperCase();
  if (!row.Size) return `GF-${prefix}-${body}`;
  return `GF-${prefix}-${body}-${row.Size === FREE_SIZE ? 'FS' : row.Size}`;
};

/**
 * Convert validated records into Shopify import rows.
 * Rows sharing a Product Name become one product; only the first row of a
 * product carries its title, body and tags, which is Shopify's own format.
 */
export const toShopifyRows = (records) => {
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

    rows.forEach((row, index) => {
      const first = index === 0;
      out.push({
        Handle: handle,
        Title: first ? row['Product Name'] : '',
        'Body (HTML)': first ? `<p>${row.Description}</p>` : '',
        Vendor: first ? VENDOR : '',
        Type: first ? (row.Category === COMBO ? 'Combo' : CATEGORIES[row.Category].title) : '',
        Tags: first ? tagsFor(row) : '',
        Published: first ? (row.Status === 'Active' ? 'TRUE' : 'FALSE') : '',

        // Single-variant products still get the variant-shaped columns, using
        // Shopify's own Title / Default Title convention — so adding a second
        // axis later means allowing extra rows, not reshaping the export.
        'Option1 Name': sized ? 'Size' : 'Title',
        'Option1 Value': sized ? row.Size : 'Default Title',

        'Variant SKU': skuFor(row, handle),
        'Variant Inventory Tracker': 'shopify',
        'Variant Inventory Qty': row.Stock,
        'Variant Inventory Policy': 'deny',
        'Variant Fulfillment Service': 'manual',
        'Variant Price': row.Price,
        'Variant Compare At Price': row['Compare At'] || '',
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        Status: first ? row.Status.toLowerCase() : '',

        // Only rings answer this question at all.
        'Metafield: custom.free_size [boolean]': first && row.Category === SIZED_CATEGORY
          ? freeSize ? 'true' : 'false'
          : '',
      });
    });
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
