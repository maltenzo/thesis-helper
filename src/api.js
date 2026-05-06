const BASE_URL = import.meta.env.PROD
  ? 'https://proxy-worker.maltenzo.workers.dev/marker/getMarkerByPage.php'
  : '/plantscrnadb-api/marker/getMarkerByPage.php';

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

export async function fetchGene(gene, filters) {
  const records = [];
  let page = 1;
  while (true) {
    const batch = await fetchGenePageRaw(gene, page, filters);
    records.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return records.filter(
    (r) =>
      r.species === 'Arabidopsis thaliana' &&
      r.tissue != null &&
      r.tissue.toLowerCase().includes('root')
  );
}
