/**
 * GIRLYF — FILL SHEET, the Google Sheets half.
 *
 * The contract is docs/FILL_SHEET.md. This script is the enforcement of it:
 * the dropdowns that make a mistyped category unrepresentable, and the row
 * checker that mirrors `validate()` in scripts/lib/fill-sheet.mjs.
 *
 * The two must agree. If a rule changes in one, change it in the other — the
 * lists and rules below are deliberately laid out in the same order as the
 * Node file so a diff between them is readable.
 *
 * Two deliberate differences, both because this side has cells to colour in
 * where the Node side only has a log to print:
 *
 *   1. A duplicate size flags EVERY row that shares it. The Node validator
 *      reports the first only, which is enough in a terminal and useless when
 *      the point is to shade the offending cells.
 *   2. HTML pasted into Description is rejected here. The converter would
 *      double-wrap it into `<p><p>…</p></p>`; catching it at the keyboard is
 *      better than catching it never.
 *
 * WHAT THIS DOES NOT DO: no cell in this sheet is ever given a formula. A
 * filler cannot break a formula that isn't there, so handles, tags and SKUs
 * stay derived by the converter, and the Problems column is written by script.
 *
 * Install:
 *   Extensions → Apps Script → paste this over Code.gs → Save.
 *   Reload the sheet, then Girlyf → Set up this sheet.
 */

// ---------------------------------------------------------------------------
// The contract, mirrored from scripts/lib/fill-sheet.mjs
// ---------------------------------------------------------------------------

/** The ten categories, fixed by the brand guidelines. Not extensible here. */
var CATEGORIES = [
  'necklaces',
  'earrings',
  'bracelets-bangles',
  'rings',
  'anklets',
  'jhumkas-ethnic-sets',
  'hair-accessories',
  'waist-chains',
  'watches',
  'keychains-charms',
];

var MATERIALS = ['gold-plated', 'oxidised', 'pearl', 'stone'];

var SIZED_CATEGORY = 'rings';
var NUMBERED_SIZES = ['S', 'M', 'L'];
var FREE_SIZE = 'Free Size';
// Lowercase, matching the `custom.category` metafield choice and the `combos`
// collection rule. See decisions/category-is-a-locked-choice-metafield.
var COMBO = 'combo';
var STATUSES = ['Draft', 'Active'];

// ---------------------------------------------------------------------------
// Sheet shape
// ---------------------------------------------------------------------------

var SHEET_NAME = 'Products';
var FIRST_DATA_ROW = 2;

/** Dropdowns and formats are applied this far down, so new rows inherit them. */
var PREPARED_ROWS = 1000;

var COL = {
  NAME: 1,
  CATEGORY: 2,
  MATERIAL: 3,
  MATERIAL_2: 4,
  SIZE: 5,
  PRICE: 6,
  COMPARE_AT: 7,
  STOCK: 8,
  DESCRIPTION: 9,
  COMBO_CONTAINS: 10,
  STATUS: 11,
  PROBLEMS: 12,
};

var HEADERS = [
  'Product Name',
  'Category',
  'Material',
  'Material 2',
  'Size',
  'Price',
  'Compare At',
  'Stock',
  'Description',
  'Combo Contains',
  'Status',
  'Problems',
];

/** Hover help. This is where a filler finds out what a column means. */
var HEADER_NOTES = {};
HEADER_NOTES[COL.NAME] =
  'Short and evocative — "Geo Lariat Necklace", never "Necklace 12".\n\n' +
  'NEVER rename a live product here. The name becomes the product\'s web address, ' +
  'so renaming creates a SECOND product. To change a display name, edit the title ' +
  'in the Shopify admin instead.';
HEADER_NOTES[COL.CATEGORY] =
  'Pick one. This files the product into its category page automatically — it is ' +
  'the whole reason this sheet exists.\n\n' +
  'Choose "combo" for a boxed set of several pieces. A combo is never also a category.';
HEADER_NOTES[COL.MATERIAL] = 'Pick one. Drives the storefront filters.';
HEADER_NOTES[COL.MATERIAL_2] =
  'Only for pieces that are genuinely two materials, e.g. gold-plated AND pearl. ' +
  'Leave blank otherwise.';
HEADER_NOTES[COL.SIZE] =
  'RINGS ONLY. Blank for everything else.\n\n' +
  'A ring in three sizes is THREE ROWS with the same Product Name — same price, ' +
  'same description, different Size and Stock.\n\n' +
  'An adjustable ring is ONE row with "Free Size". It gets a Free Size badge and ' +
  'no size picker.';
HEADER_NOTES[COL.PRICE] =
  'Rupees. Digits only — no ₹ symbol, no commas. 1050, not ₹1,050.';
HEADER_NOTES[COL.COMPARE_AT] =
  'The was-price, struck through on the storefront. Must be HIGHER than Price. ' +
  'Leave blank if the piece is not on sale.\n\n' +
  'On a combo, set this to the sum of the pieces inside — otherwise the saving is invisible.';
HEADER_NOTES[COL.STOCK] =
  'How many you have. On a sized ring this is per row, so per size.\n\n' +
  'Blank is NOT zero. Blank is a missing answer and fails the check. ' +
  'Genuinely out of stock is 0.';
HEADER_NOTES[COL.DESCRIPTION] =
  'Brand tone: warm, elegant, short. One or two sentences. Not a spec sheet.\n\n' +
  'Write plain sentences. Do not paste HTML — the formatting is added for you.';
HEADER_NOTES[COL.COMBO_CONTAINS] =
  'COMBOS ONLY. The web addresses of the pieces inside, comma separated:\n' +
  'geo-lariat-necklace, heart-charm-necklace\n\n' +
  'That is the Product Name in lower case with hyphens for spaces.';
HEADER_NOTES[COL.STATUS] =
  'Draft until the product has photographs. Active makes it public.\n\n' +
  'Photographs and videos are added in the Shopify admin, never in this sheet.';
HEADER_NOTES[COL.PROBLEMS] =
  'Written by the checker. Do not type here — anything you type is overwritten.\n\n' +
  'Empty means the row will import cleanly.';

var COLUMN_WIDTHS = {};
COLUMN_WIDTHS[COL.NAME] = 200;
COLUMN_WIDTHS[COL.CATEGORY] = 150;
COLUMN_WIDTHS[COL.MATERIAL] = 110;
COLUMN_WIDTHS[COL.MATERIAL_2] = 110;
COLUMN_WIDTHS[COL.SIZE] = 90;
COLUMN_WIDTHS[COL.PRICE] = 80;
COLUMN_WIDTHS[COL.COMPARE_AT] = 90;
COLUMN_WIDTHS[COL.STOCK] = 70;
COLUMN_WIDTHS[COL.DESCRIPTION] = 420;
COLUMN_WIDTHS[COL.COMBO_CONTAINS] = 220;
COLUMN_WIDTHS[COL.STATUS] = 90;
COLUMN_WIDTHS[COL.PROBLEMS] = 340;

// Brand-adjacent, legible at a glance. Errors read louder than warnings.
var INK = '#2e2a28';
var HEADER_BG = '#f4ece7';
var ERROR_BG = '#fce4e4';
var WARNING_BG = '#fdf3d8';
var NOT_APPLICABLE_BG = '#f3f3f3';
var ERROR_INK = '#a3232b';
var WARNING_INK = '#8a6100';

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Girlyf')
    .addItem('Check every row', 'checkSheet')
    .addSeparator()
    .addItem('Set up this sheet', 'setUpSheet')
    .addToUi();
}

// ---------------------------------------------------------------------------
// Setup — idempotent. Safe to re-run after a rule changes.
// ---------------------------------------------------------------------------

function setUpSheet() {
  var sheet = getProductSheet_();
  var ui = SpreadsheetApp.getUi();

  var existing = sheet
    .getRange(1, 1, 1, HEADERS.length - 1)
    .getValues()[0]
    .filter(String);

  if (existing.length && existing.join('|') !== HEADERS.slice(0, -1).join('|')) {
    var proceed = ui.alert(
      'These headers do not match the fill sheet contract',
      'Row 1 will be replaced with the eleven contract columns. Your data rows are ' +
        'not touched, but if the columns are in a different order they will end up ' +
        'under the wrong headers.\n\nContinue?',
      ui.ButtonSet.YES_NO,
    );
    if (proceed !== ui.Button.YES) return;
  }

  ensureRoom_(sheet);
  writeHeader_(sheet);
  applyDropdowns_(sheet);
  applyFormats_(sheet);
  applyNotApplicableShading_(sheet);
  lockTheStructure_(sheet);

  sheet.setFrozenRows(1);
  if (sheet.getMaxColumns() > HEADERS.length) {
    sheet.hideColumns(HEADERS.length + 1, sheet.getMaxColumns() - HEADERS.length);
  }

  checkSheet();

  ui.alert(
    'Ready',
    'Dropdowns, help notes and the row checker are in place.\n\n' +
      'Every row is now checked as you type. When the Problems column is empty ' +
      'all the way down, download the sheet as CSV and hand it over for import.',
    ui.ButtonSet.OK,
  );
}

function writeHeader_(sheet) {
  var header = sheet.getRange(1, 1, 1, HEADERS.length);
  header
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setFontColor(INK)
    .setBackground(HEADER_BG)
    .setVerticalAlignment('middle')
    .setWrap(false);

  sheet.setRowHeight(1, 34);

  for (var column = 1; column <= HEADERS.length; column++) {
    sheet.setColumnWidth(column, COLUMN_WIDTHS[column]);
    sheet.getRange(1, column).setNote(HEADER_NOTES[column] || '');
  }

  // The checker owns this column, so say so where it cannot be missed.
  sheet.getRange(1, COL.PROBLEMS).setBackground('#e8e8e8').setFontColor('#5a5a5a');
}

function applyDropdowns_(sheet) {
  var rows = PREPARED_ROWS - FIRST_DATA_ROW + 1;

  // `setAllowInvalid(false)` is the point of the whole exercise: a typo in a
  // category is not caught later, it is refused now. The failure mode of a
  // free-text category is silence — the product imports and simply never
  // appears in navigation.
  var lists = {};
  lists[COL.CATEGORY] = CATEGORIES.concat([COMBO]);
  lists[COL.MATERIAL] = MATERIALS;
  lists[COL.MATERIAL_2] = MATERIALS;
  lists[COL.SIZE] = NUMBERED_SIZES.concat([FREE_SIZE]);
  lists[COL.STATUS] = STATUSES;

  Object.keys(lists).forEach(function (column) {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(lists[column], true)
      .setAllowInvalid(false)
      .setHelpText('Pick from the list. Typing anything else is not allowed.')
      .build();
    sheet.getRange(FIRST_DATA_ROW, Number(column), rows, 1).setDataValidation(rule);
  });
}

function applyFormats_(sheet) {
  var rows = PREPARED_ROWS - FIRST_DATA_ROW + 1;

  // Plain integers, deliberately. A currency or thousands format would export
  // as "₹1,050" or "1,050" in the CSV, and the converter reads digits only.
  sheet.getRange(FIRST_DATA_ROW, COL.PRICE, rows, 1).setNumberFormat('0');
  sheet.getRange(FIRST_DATA_ROW, COL.COMPARE_AT, rows, 1).setNumberFormat('0');
  sheet.getRange(FIRST_DATA_ROW, COL.STOCK, rows, 1).setNumberFormat('0');

  sheet.getRange(FIRST_DATA_ROW, COL.DESCRIPTION, rows, 1).setWrap(true);
  sheet.getRange(FIRST_DATA_ROW, COL.PROBLEMS, rows, 1).setWrap(true);

  sheet
    .getRange(FIRST_DATA_ROW, 1, rows, HEADERS.length)
    .setVerticalAlignment('top')
    .setFontColor(INK);

  sheet
    .getRange(FIRST_DATA_ROW, COL.PROBLEMS, rows, 1)
    .setFontSize(9)
    .setFontColor(ERROR_INK);
}

/**
 * Grey the cells a row has no business filling in — Size on a necklace, Combo
 * Contains on a ring. Only when the cell is empty, so that a wrongly filled one
 * still shows its error colour instead of hiding under the grey.
 */
function applyNotApplicableShading_(sheet) {
  var rows = PREPARED_ROWS - FIRST_DATA_ROW + 1;

  var sizeCells = sheet.getRange(FIRST_DATA_ROW, COL.SIZE, rows, 1);
  var comboCells = sheet.getRange(FIRST_DATA_ROW, COL.COMBO_CONTAINS, rows, 1);

  var rules = sheet.getConditionalFormatRules().filter(function (rule) {
    // Drop only the rules a previous run of this script created.
    var ranges = rule.getRanges().map(function (r) {
      return r.getA1Notation();
    });
    return (
      ranges.indexOf(sizeCells.getA1Notation()) === -1 &&
      ranges.indexOf(comboCells.getA1Notation()) === -1
    );
  });

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A2<>"", $B2<>"' + SIZED_CATEGORY + '", $E2="")')
      .setBackground(NOT_APPLICABLE_BG)
      .setRanges([sizeCells])
      .build(),
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A2<>"", $B2<>"' + COMBO + '", $J2="")')
      .setBackground(NOT_APPLICABLE_BG)
      .setRanges([comboCells])
      .build(),
  );

  sheet.setConditionalFormatRules(rules);
}

function lockTheStructure_(sheet) {
  var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getDescription() === 'Girlyf — script owned') {
      existing[i].remove();
    }
  }

  // Warning-only: an accidental edit is stopped, a deliberate one is not. The
  // header and the Problems column are both written by this script.
  [
    sheet.getRange(1, 1, 1, HEADERS.length),
    sheet.getRange(FIRST_DATA_ROW, COL.PROBLEMS, PREPARED_ROWS - 1, 1),
  ].forEach(function (range) {
    range
      .protect()
      .setDescription('Girlyf — script owned')
      .setWarningOnly(true);
  });
}

// ---------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------

function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  if (e.range.getRow() === 1) return;
  if (e.range.getColumn() === COL.PROBLEMS) return;

  // Cross-row rules — duplicate sizes, a name whose rows disagree — mean the
  // whole sheet is the unit of validation, not the edited row.
  checkSheet();
}

function checkSheet() {
  var sheet = getProductSheet_();
  var lastRow = sheet.getLastRow();

  if (lastRow < FIRST_DATA_ROW) {
    clearMarks_(sheet, FIRST_DATA_ROW, PREPARED_ROWS - FIRST_DATA_ROW + 1);
    return { errors: 0, warnings: 0 };
  }

  var count = lastRow - FIRST_DATA_ROW + 1;
  var values = sheet.getRange(FIRST_DATA_ROW, 1, count, HEADERS.length - 1).getValues();

  var rows = values.map(function (value, index) {
    return readRow_(value, FIRST_DATA_ROW + index);
  });

  var filled = rows.filter(function (row) {
    return row._filled;
  });

  var problems = validate_(filled);

  paint_(sheet, rows, problems);

  var errors = problems.filter(function (p) {
    return p.severity === 'error';
  });

  return { errors: errors.length, warnings: problems.length - errors.length };
}

function readRow_(value, line) {
  var text = function (column) {
    return String(value[column - 1] == null ? '' : value[column - 1]).trim();
  };
  var row = {
    _line: line,
    name: text(COL.NAME),
    category: text(COL.CATEGORY),
    material: text(COL.MATERIAL),
    material2: text(COL.MATERIAL_2),
    size: text(COL.SIZE),
    price: text(COL.PRICE),
    compareAt: text(COL.COMPARE_AT),
    stock: text(COL.STOCK),
    description: text(COL.DESCRIPTION),
    comboContains: text(COL.COMBO_CONTAINS),
    status: text(COL.STATUS),
  };
  row._filled = [
    row.name, row.category, row.material, row.material2, row.size,
    row.price, row.compareAt, row.stock, row.description,
    row.comboContains, row.status,
  ].some(String);
  return row;
}

var isPositiveNumber_ = function (v) {
  return /^\d+(\.\d+)?$/.test(v) && Number(v) > 0;
};
var isNonNegativeInteger_ = function (v) {
  return /^\d+$/.test(v) && Number(v) >= 0;
};

/**
 * Mirrors `validate()` in scripts/lib/fill-sheet.mjs, in the same order.
 * Returns [{ line, column, severity, message }].
 */
function validate_(rows) {
  var problems = [];
  var at = function (row, column, message, severity) {
    problems.push({
      line: row._line,
      column: column,
      severity: severity || 'error',
      message: message,
    });
  };

  var byName = {};

  rows.forEach(function (row) {
    var isCombo = row.category === COMBO;

    if (!row.name) {
      at(row, COL.NAME, 'Required, and blank.');
      return;
    }

    // --- category ---------------------------------------------------------
    if (!row.category) {
      at(row, COL.CATEGORY, 'Required, and blank. Pick one from the dropdown.');
    } else if (!isCombo && CATEGORIES.indexOf(row.category) === -1) {
      at(
        row,
        COL.CATEGORY,
        '"' + row.category + '" is not one of the ten categories or "' + COMBO + '".',
      );
    }

    // --- materials --------------------------------------------------------
    if (!row.material) {
      at(row, COL.MATERIAL, 'Required, and blank. Pick one from the dropdown.');
    } else if (MATERIALS.indexOf(row.material) === -1) {
      at(row, COL.MATERIAL, '"' + row.material + '" is not one of: ' + MATERIALS.join(', ') + '.');
    }
    if (row.material2) {
      if (MATERIALS.indexOf(row.material2) === -1) {
        at(row, COL.MATERIAL_2, '"' + row.material2 + '" is not one of: ' + MATERIALS.join(', ') + '.');
      } else if (row.material2 === row.material) {
        at(row, COL.MATERIAL_2, 'Same as Material. It will be ignored.', 'warning');
      }
    }

    // --- size: rings only -------------------------------------------------
    var allSizes = NUMBERED_SIZES.concat([FREE_SIZE]);
    if (row.size) {
      if (row.category !== SIZED_CATEGORY) {
        at(
          row,
          COL.SIZE,
          'Only ' + SIZED_CATEGORY + ' have sizes. Leave Size blank for "' + row.category + '".',
        );
      } else if (allSizes.indexOf(row.size) === -1) {
        at(row, COL.SIZE, '"' + row.size + '" is not one of: ' + allSizes.join(', ') + '.');
      }
    } else if (row.category === SIZED_CATEGORY) {
      at(row, COL.SIZE, 'A ring needs a Size — one of ' + allSizes.join(', ') + '.');
    }

    // --- money ------------------------------------------------------------
    if (!row.price) {
      at(row, COL.PRICE, 'Required, and blank.');
    } else if (!isPositiveNumber_(row.price)) {
      at(row, COL.PRICE, '"' + row.price + '" is not a price. Digits only, no ₹ and no commas.');
    }

    if (row.compareAt) {
      if (!isPositiveNumber_(row.compareAt)) {
        at(row, COL.COMPARE_AT, '"' + row.compareAt + '" is not a price.');
      } else if (Number(row.compareAt) <= Number(row.price)) {
        at(
          row,
          COL.COMPARE_AT,
          'Must be higher than Price — it is the was-price. Leave blank if not on sale.',
        );
      }
    }

    // --- stock ------------------------------------------------------------
    if (row.stock === '') {
      at(row, COL.STOCK, 'Required. A blank is a missing answer; genuinely out of stock is 0.');
    } else if (!isNonNegativeInteger_(row.stock)) {
      at(row, COL.STOCK, '"' + row.stock + '" is not a whole number of items.');
    }

    // --- description, status ---------------------------------------------
    if (!row.description) {
      at(row, COL.DESCRIPTION, 'Required, and blank.');
    } else if (/<[a-z][\s\S]*>/i.test(row.description)) {
      at(
        row,
        COL.DESCRIPTION,
        'Write plain sentences. The formatting tags are added for you on import.',
      );
    }

    if (STATUSES.indexOf(row.status) === -1) {
      at(row, COL.STATUS, '"' + row.status + '" is not Draft or Active.');
    }

    // --- combos -----------------------------------------------------------
    if (isCombo && !row.comboContains) {
      at(row, COL.COMBO_CONTAINS, 'A combo must list the handles of the pieces inside it.');
    }
    if (!isCombo && row.comboContains) {
      at(
        row,
        COL.COMBO_CONTAINS,
        'Only rows with Category "' + COMBO + '" may list combo contents.',
      );
    }
    if (isCombo && !row.compareAt) {
      at(
        row,
        COL.COMPARE_AT,
        'A combo with no was-price shows no saving. Set it to the sum of the parts.',
        'warning',
      );
    }

    if (!byName[row.name]) byName[row.name] = [];
    byName[row.name].push(row);
  });

  // --- cross-row checks, per product ---------------------------------------
  Object.keys(byName).forEach(function (name) {
    var group = byName[name];
    var sizes = group.map(function (r) {
      return r.size;
    });

    var seen = {};
    var duplicated = {};
    sizes.forEach(function (size) {
      if (seen[size]) duplicated[size] = true;
      seen[size] = true;
    });
    Object.keys(duplicated).forEach(function (size) {
      group
        .filter(function (r) {
          return r.size === size;
        })
        .forEach(function (r) {
          problems.push({
            line: r._line,
            column: COL.SIZE,
            severity: 'error',
            message: '"' + name + '" has two rows for size "' + (size || '(none)') + '".',
          });
        });
    });

    var hasFree = sizes.indexOf(FREE_SIZE) !== -1;
    var hasNumbered = sizes.some(function (s) {
      return NUMBERED_SIZES.indexOf(s) !== -1;
    });
    if (hasFree && hasNumbered) {
      problems.push({
        line: group[0]._line,
        column: COL.SIZE,
        severity: 'error',
        message:
          '"' + name + '" mixes ' + FREE_SIZE + ' with numbered sizes. A piece is one or the other.',
      });
    }

    [
      { key: 'price', column: COL.PRICE, label: 'Price' },
      { key: 'description', column: COL.DESCRIPTION, label: 'Description' },
      { key: 'category', column: COL.CATEGORY, label: 'Category' },
      { key: 'status', column: COL.STATUS, label: 'Status' },
    ].forEach(function (field) {
      var distinct = {};
      group.forEach(function (r) {
        distinct[r[field.key]] = true;
      });
      if (Object.keys(distinct).length > 1) {
        problems.push({
          line: group[1]._line,
          column: field.column,
          severity: 'warning',
          message:
            '"' + name + '" has different ' + field.label +
            ' values across its size rows. The first row wins.',
        });
      }
    });
  });

  return problems;
}

// ---------------------------------------------------------------------------
// Painting the result
// ---------------------------------------------------------------------------

function paint_(sheet, rows, problems) {
  var count = rows.length;
  clearMarks_(sheet, FIRST_DATA_ROW, count);

  var backgrounds = [];
  var messages = [];
  for (var i = 0; i < count; i++) {
    backgrounds.push(new Array(HEADERS.length - 1).fill(null));
    messages.push(['']);
  }

  var collected = {};
  problems.forEach(function (problem) {
    var index = problem.line - FIRST_DATA_ROW;
    if (index < 0 || index >= count) return;

    var current = backgrounds[index][problem.column - 1];
    // An error on a cell outranks a warning on the same cell.
    if (current !== ERROR_BG) {
      backgrounds[index][problem.column - 1] =
        problem.severity === 'error' ? ERROR_BG : WARNING_BG;
    }

    if (!collected[index]) collected[index] = { errors: [], warnings: [] };
    var line = HEADERS[problem.column - 1] + ': ' + problem.message;
    collected[index][problem.severity === 'error' ? 'errors' : 'warnings'].push(line);
  });

  var inks = [];
  for (var row = 0; row < count; row++) {
    var found = collected[row];
    if (!found) {
      inks.push([ERROR_INK]);
      continue;
    }
    messages[row] = [found.errors.concat(found.warnings).join('\n')];
    inks.push([found.errors.length ? ERROR_INK : WARNING_INK]);
  }

  sheet.getRange(FIRST_DATA_ROW, 1, count, HEADERS.length - 1).setBackgrounds(backgrounds);
  sheet.getRange(FIRST_DATA_ROW, COL.PROBLEMS, count, 1).setValues(messages);
  sheet.getRange(FIRST_DATA_ROW, COL.PROBLEMS, count, 1).setFontColors(inks);

  drawProductGroups_(sheet, rows);
}

function clearMarks_(sheet, startRow, count) {
  var room = sheet.getMaxRows() - startRow + 1;
  var rows = Math.min(count, room);
  if (rows < 1) return;

  sheet.getRange(startRow, 1, rows, HEADERS.length - 1).setBackground(null);
  // Borders span the Problems column too, so clear the full width.
  sheet.getRange(startRow, 1, rows, HEADERS.length).setBorder(false, false, false, false, false, false);
  sheet.getRange(startRow, COL.PROBLEMS, rows, 1).clearContent();
}

/**
 * A sized ring is three rows that are one product, and that is the single most
 * confusing thing about this sheet. A rule above each new Product Name makes
 * the grouping visible without a merged cell, which would break CSV export.
 */
function drawProductGroups_(sheet, rows) {
  var previous = null;
  rows.forEach(function (row) {
    if (!row._filled) return;
    if (previous !== null && row.name === previous) return;
    previous = row.name;
    sheet
      .getRange(row._line, 1, 1, HEADERS.length)
      .setBorder(true, null, null, null, null, null, '#c9beb6', SpreadsheetApp.BorderStyle.SOLID);
  });
}

// ---------------------------------------------------------------------------

/** Dropdowns are applied to a fixed depth, so the rows have to exist first. */
function ensureRoom_(sheet) {
  var missing = PREPARED_ROWS - sheet.getMaxRows();
  if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missing);
  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }
}

function getProductSheet_() {
  var spreadsheet = SpreadsheetApp.getActive();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (sheet) return sheet;

  // Adopt a single untitled sheet rather than leaving an empty one behind.
  var sheets = spreadsheet.getSheets();
  if (sheets.length === 1) {
    return sheets[0].setName(SHEET_NAME);
  }
  return spreadsheet.insertSheet(SHEET_NAME);
}
