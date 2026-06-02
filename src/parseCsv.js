function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

export function parseScoringCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  });
}

export function parseDeCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return new Map();
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const groupIdx  = headers.indexOf('group');
  const namesIdx  = headers.indexOf('names');
  const scoresIdx = headers.indexOf('scores');
  const logfcIdx  = headers.indexOf('logfoldchanges');
  const pctIdx    = headers.indexOf('pct_nz_group');
  if (groupIdx === -1 || namesIdx === -1) return new Map();

  const byCluster = new Map();
  for (const line of lines.slice(1)) {
    const vals  = splitCsvLine(line);
    const group = (vals[groupIdx] ?? '').trim();
    const name  = (vals[namesIdx] ?? '').trim();
    if (!group || !name) continue;
    if (!byCluster.has(group)) byCluster.set(group, []);
    byCluster.get(group).push({
      name,
      zscore: scoresIdx !== -1 ? parseFloat(vals[scoresIdx]) : null,
      logFC:  logfcIdx  !== -1 ? parseFloat(vals[logfcIdx])  : null,
      pct:    pctIdx    !== -1 ? parseFloat(vals[pctIdx])     : null,
    });
  }
  return byCluster;
}

export function cleanLabel(s) {
  return (s ?? '').replace(/\s*\([^)]+\)\s*$/, '').trim();
}
