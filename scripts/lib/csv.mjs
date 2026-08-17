// Minimal RFC-4180 CSV read/write. No dependency, because a build step that needs
// `npm install` to convert a spreadsheet is a build step that rots.

/** Parse CSV text into an array of row objects keyed by header. */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // Strip a BOM — Excel and Google Sheets both emit one, and it silently
  // corrupts the first header name.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // Ignore trailing blank lines, but keep genuinely empty cells.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"' && field === '') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      endField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== '' || row.length) endRow();

  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells, index) => {
    const record = { _line: index + 2 };
    headers.forEach((h, n) => {
      record[h] = (cells[n] ?? '').trim();
    });
    return record;
  });

  return { headers, records };
};

/** Serialise rows (array of objects) to CSV using the given column order. */
export const toCsv = (columns, rows) => {
  const cell = (value) => {
    const s = value === undefined || value === null ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(cell).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
  return `${lines.join('\n')}\n`;
};
