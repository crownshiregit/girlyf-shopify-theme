import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { validate, toShopifyRows, comboLinks, slugify } from './lib/fill-sheet.mjs';

const TEMPLATE = 'sheet/girlyf-fill-sheet-template.csv';

const sheet = (rows) => {
  const columns = [
    'Product Name', 'Category', 'Material', 'Material 2', 'Size',
    'Price', 'Compare At', 'Stock', 'Description', 'Combo Contains', 'Status',
  ];
  const base = {
    'Product Name': 'Test Piece', Category: 'necklaces', Material: 'gold-plated',
    'Material 2': '', Size: '', Price: '499', 'Compare At': '', Stock: '5',
    Description: 'A piece.', 'Combo Contains': '', Status: 'Active',
  };
  return parseCsv(toCsv(columns, rows.map((r) => ({ ...base, ...r })))).records;
};

const errorsFor = (rows) => validate(sheet(rows)).errors.map((e) => `${e.column}: ${e.message}`);

// --- CSV -------------------------------------------------------------------

test('parses quoted fields containing commas and escaped quotes', () => {
  const { records } = parseCsv('a,b\n"one, two","he said ""hi"""\n');
  assert.equal(records[0].a, 'one, two');
  assert.equal(records[0].b, 'he said "hi"');
});

test('strips a leading BOM so the first header is not corrupted', () => {
  const { headers } = parseCsv('﻿Product Name,Category\nx,necklaces\n');
  assert.deepEqual(headers, ['Product Name', 'Category']);
});

// --- the shipped template --------------------------------------------------

test('the shipped template validates clean', () => {
  const { records } = parseCsv(readFileSync(TEMPLATE, 'utf8'));
  const { errors } = validate(records);
  assert.deepEqual(errors, [], `template has errors: ${JSON.stringify(errors, null, 2)}`);
});

test('the template produces one product per name, three variants for the ring', () => {
  const { records } = parseCsv(readFileSync(TEMPLATE, 'utf8'));
  const rows = toShopifyRows(records);
  const ring = rows.filter((r) => r.Handle === 'clover-stacking-ring');

  assert.equal(ring.length, 3, 'the sized ring is three variant rows');
  assert.deepEqual(ring.map((r) => r['Option1 Value']), ['S', 'M', 'L']);
  assert.equal(ring[0]['Option1 Name'], 'Size');
  assert.equal(ring[0].Title, 'Clover Stacking Ring');
  assert.equal(ring[1].Title, '', 'continuation rows carry no title');
  assert.equal(ring[1].Tags, '', 'continuation rows carry no tags');
});

// --- tags ------------------------------------------------------------------

test('every emitted tag is namespaced', () => {
  const { records } = parseCsv(readFileSync(TEMPLATE, 'utf8'));
  for (const row of toShopifyRows(records)) {
    if (!row.Tags) continue;
    for (const tag of row.Tags.split(', ')) {
      assert.match(tag, /^(category:|material:|edit:)|^combo$/, `bare tag emitted: "${tag}"`);
    }
  }
});

test('a combo gets the combo tag and no category tag', () => {
  const rows = toShopifyRows(sheet([
    { 'Product Name': 'Duo Box', Category: 'Combo', 'Compare At': '899',
      'Combo Contains': 'geo-lariat-necklace, heart-charm-necklace' },
  ]));
  assert.equal(rows[0].Tags, 'combo, material:gold-plated');
  assert.doesNotMatch(rows[0].Tags, /category:/);
});

test('a second material adds a second tag; a duplicate one does not', () => {
  const [both] = toShopifyRows(sheet([{ Material: 'gold-plated', 'Material 2': 'pearl' }]));
  assert.equal(both.Tags, 'category:necklaces, material:gold-plated, material:pearl');

  const [same] = toShopifyRows(sheet([{ Material: 'pearl', 'Material 2': 'pearl' }]));
  assert.equal(same.Tags, 'category:necklaces, material:pearl');
});

// --- free size -------------------------------------------------------------

test('Free Size is a single-variant product with no size selector', () => {
  const rows = toShopifyRows(sheet([
    { 'Product Name': 'Open Band', Category: 'rings', Size: 'Free Size' },
  ]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Option1 Name'], 'Title');
  assert.equal(rows[0]['Option1 Value'], 'Default Title');
  assert.equal(rows[0]['Metafield: custom.free_size [boolean]'], 'true');
  assert.equal(rows[0]['Variant SKU'], 'GF-RIN-OPEN-BAND-FS');
});

test('a sized ring is not free size; a necklace answers neither way', () => {
  const [sized] = toShopifyRows(sheet([
    { 'Product Name': 'Clover Ring', Category: 'rings', Size: 'M' },
  ]));
  assert.equal(sized['Metafield: custom.free_size [boolean]'], 'false');
  assert.equal(sized['Variant SKU'], 'GF-RIN-CLOVER-RING-M');

  const [necklace] = toShopifyRows(sheet([{}]));
  assert.equal(necklace['Metafield: custom.free_size [boolean]'], '');
});

// --- validation ------------------------------------------------------------

test('rejects a category outside the fixed ten', () => {
  assert.match(errorsFor([{ Category: 'bangles' }]).join(), /not one of the ten categories/);
});

test('rejects a size on anything but a ring, and a ring with no size', () => {
  assert.match(errorsFor([{ Category: 'earrings', Size: 'M' }]).join(), /Only rings have sizes/);
  assert.match(errorsFor([{ Category: 'rings', Size: '' }]).join(), /A ring needs a Size/);
});

test('rejects a blank stock but accepts zero', () => {
  assert.match(errorsFor([{ Stock: '' }]).join(), /blank is a missing answer/);
  assert.deepEqual(errorsFor([{ Stock: '0' }]), []);
});

test('rejects a was-price that is not higher than the price', () => {
  assert.match(errorsFor([{ Price: '499', 'Compare At': '499' }]).join(), /higher than Price/);
  assert.deepEqual(errorsFor([{ Price: '499', 'Compare At': '699' }]), []);
});

test('rejects prices with symbols or separators', () => {
  assert.match(errorsFor([{ Price: '₹499' }]).join(), /not a price/);
  assert.match(errorsFor([{ Price: '1,499' }]).join(), /not a price/);
});

test('rejects combo contents on a non-combo, and a combo with none', () => {
  assert.match(errorsFor([{ 'Combo Contains': 'a,b' }]).join(), /Only rows with Category "Combo"/);
  assert.match(
    errorsFor([{ Category: 'Combo', 'Combo Contains': '' }]).join(),
    /must list the handles/,
  );
});

test('rejects two rows for the same size, and Free Size mixed with numbered sizes', () => {
  const dupe = errorsFor([
    { 'Product Name': 'Ring', Category: 'rings', Size: 'M' },
    { 'Product Name': 'Ring', Category: 'rings', Size: 'M' },
  ]);
  assert.match(dupe.join(), /two rows for size "M"/);

  const mixed = errorsFor([
    { 'Product Name': 'Ring', Category: 'rings', Size: 'Free Size' },
    { 'Product Name': 'Ring', Category: 'rings', Size: 'L' },
  ]);
  assert.match(mixed.join(), /mixes Free Size with numbered sizes/);
});

test('warns, but does not fail, when size rows disagree on price', () => {
  const rows = sheet([
    { 'Product Name': 'Ring', Category: 'rings', Size: 'S', Price: '449' },
    { 'Product Name': 'Ring', Category: 'rings', Size: 'M', Price: '499' },
  ]);
  const { errors, warnings } = validate(rows);
  assert.deepEqual(errors, []);
  assert.match(warnings.map((w) => w.message).join(), /different Price values/);
});

// --- status and combos -----------------------------------------------------

test('Draft status is not published', () => {
  const [draft] = toShopifyRows(sheet([{ Status: 'Draft' }]));
  assert.equal(draft.Published, 'FALSE');
  assert.equal(draft.Status, 'draft');
});

test('combo contents are reported for manual linking', () => {
  const links = comboLinks(sheet([
    { 'Product Name': 'Duo Box', Category: 'Combo', 'Compare At': '899',
      'Combo Contains': 'geo-lariat-necklace, heart-charm-necklace' },
  ]));
  assert.deepEqual(links, [{
    handle: 'duo-box',
    title: 'Duo Box',
    contains: ['geo-lariat-necklace', 'heart-charm-necklace'],
  }]);
});

test('slugify collapses punctuation and trims edges', () => {
  assert.equal(slugify('  Geo Lariat — Necklace!  '), 'geo-lariat-necklace');
});
