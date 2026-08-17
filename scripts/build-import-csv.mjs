#!/usr/bin/env node
// Validates the Girlyf fill sheet and writes a Shopify product-import CSV.
//
//   npm run sheet:check                      # validate the template
//   node scripts/build-import-csv.mjs <in.csv> [--out shopify-import.csv]
//   node scripts/build-import-csv.mjs <in.csv> --validate
//
// Needs no credentials and touches no store. The output is imported by Girlyf in
// the Shopify admin — see docs/FILL_SHEET.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { validate, toShopifyRows, comboLinks, SHOPIFY_COLUMNS } from './lib/fill-sheet.mjs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const validateOnly = args.includes('--validate');
const outIndex = args.indexOf('--out');
const output = outIndex !== -1 ? args[outIndex + 1] : 'shopify-import.csv';

if (!input) {
  console.error('Usage: build-import-csv.mjs <fill-sheet.csv> [--out <file>] [--validate]');
  process.exit(2);
}

const { records } = parseCsv(readFileSync(input, 'utf8'));
const { errors, warnings } = validate(records);

const show = (label, items) => {
  console.log(`\n${label}`);
  for (const { line, column, message } of items) {
    const where = line ? `row ${line}` : 'sheet';
    console.log(`  ${where}${column ? ` · ${column}` : ''} — ${message}`);
  }
};

if (warnings.length) show(`${warnings.length} warning(s)`, warnings);

if (errors.length) {
  show(`${errors.length} error(s) — nothing was written`, errors);
  console.log('\nFix these in the sheet and run again. See docs/FILL_SHEET.md.');
  process.exit(1);
}

const rows = toShopifyRows(records);
const products = new Set(rows.map((r) => r.Handle)).size;

console.log(`\n✓ ${records.length} sheet row(s) → ${products} product(s), ${rows.length} variant row(s)`);

if (validateOnly) {
  console.log('  --validate: nothing written.');
} else {
  writeFileSync(output, toCsv(SHOPIFY_COLUMNS, rows));
  console.log(`  written: ${output}`);
}

// The one thing the sheet describes but cannot deliver: handles are not Shopify
// references, so combo contents are linked in the admin, once, per combo.
const combos = comboLinks(records);
if (combos.length) {
  console.log('\nLink these by hand in the admin (metafield custom.combo_items):');
  for (const combo of combos) {
    console.log(`  ${combo.handle} → ${combo.contains.join(', ')}`);
  }
}

const drafts = rows.filter((r) => r.Status === 'draft').length;
if (drafts) {
  console.log(`\n${drafts} product(s) import as Draft. They go Active when they have photographs.`);
}
