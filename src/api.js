const BASE_URL = '/plantscrnadb-api/marker/getMarkerByPage.php';

async function fetchGenePageRaw(gene, page, filters) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      currentPage: page,
      pageSize: 100,
      celltypes: null,
      markerGenes: gene,
      species: null,
      highConfidenceGenes: filters.highConfidence ? '1' : '',
      singleCellGenes: filters.singleCell ? '1' : '',
      uniqueGenes: filters.uniqueGenes ? '1' : '',
      enzymoGenes: '',
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchGene(gene, filters, onProgress) {
  const cache = fetchGene._cache;
  const key = `${gene}|${filters.highConfidence}|${filters.singleCell}|${filters.uniqueGenes}`;
  if (cache.has(key)) return cache.get(key);

  const records = [];
  let page = 1;
  while (true) {
    const batch = await fetchGenePageRaw(gene, page, filters);
    records.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  const rootRecords = records.filter(
    (r) =>
      r.species === 'Arabidopsis thaliana' &&
      r.tissue != null &&
      r.tissue.toLowerCase().includes('root')
  );

  cache.set(key, rootRecords);
  if (onProgress) onProgress(gene, rootRecords);
  return rootRecords;
}
fetchGene._cache = new Map();

export function clearCache() {
  fetchGene._cache.clear();
}
