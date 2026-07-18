// origin serves HTTPS with CORS `*` directly to the browser (same path the official site uses),
// so we skip the Cloudflare Worker proxy entirely — it was the source of the 524/526 errors
const BASE_URL = import.meta.env.PROD
  ? 'https://ibi.zju.edu.cn/PlantscRNAdb_v4/api/marker/getMarkerByPage.php'
  : '/plantscrnadb-api/marker/getMarkerByPage.php';

// upstream is a flaky academic server; retry a page once (worker already retries its own
// upstream call, so this covers failures between the browser and the worker itself)
const PAGE_TIMEOUT_MS = 15000;
const PAGE_RETRIES = 1;
const MAX_PAGES = 50; // safety net against a runaway/misbehaving upstream, not a real limit

async function fetchGenePageRaw(gene, page) {
  let lastErr;
  for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          currentPage: page,
          pageSize: 100,
          celltypes: null,
          markerGenes: gene,
          species: null,
          highConfidenceGenes: '',
          singleCellGenes: '',
          uniqueGenes: '',
          enzymoGenes: '',
        }),
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      lastErr = err;
      if (attempt < PAGE_RETRIES) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

export async function fetchGene(gene, filters) {
  const records = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const batch = await fetchGenePageRaw(gene, page);
    records.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return records.filter(
    (r) =>
      r.species === 'Arabidopsis thaliana' &&
      r.tissue != null &&
      r.tissue.toLowerCase().includes('root') &&
      (!filters.highConfidence || r.high_confidence_genes === 'Yes') &&
      (!filters.singleCell || r.single_cell_genes === 'Yes') &&
      (!filters.uniqueGenes || r.unique_genes === 'Yes')
  );
}
