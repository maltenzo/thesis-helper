import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchGene } from './api';

// gene fetches hit a fragile upstream server that falls over under concurrent load,
// so we release one query at a time, waiting this long after each settles
const QUERY_STAGGER_MS = 500;

// each cell of the matrix is a record: best (highest-cosg) marker hit for a gene×celltype
const ZERO_REC = { cosg: 0, log2fc: 0, pct1: 0, pct2: 0 };

function serializeMap(map) {
  return Object.fromEntries([...map].map(([k, recs]) => [k, Object.fromEntries(recs)]));
}

function deserializeMap(obj) {
  return new Map(
    Object.entries(obj).map(([k, v]) => [
      k,
      // ponytail: tolerate old saved clusters where value was a plain string[] (presence only)
      Array.isArray(v)
        ? new Map(v.map((name) => [name, ZERO_REC]))
        : new Map(Object.entries(v)),
    ])
  );
}

export function serializeResults(geneMap, cellTypeMap) {
  return { geneMap: serializeMap(geneMap), cellTypeMap: serializeMap(cellTypeMap) };
}

export function deserializeResults({ geneMap, cellTypeMap }) {
  return { geneMap: deserializeMap(geneMap), cellTypeMap: deserializeMap(cellTypeMap) };
}

function geneQueryKey(gene, filters) {
  return ['gene', gene, !!filters.highConfidence, !!filters.singleCell, !!filters.uniqueGenes];
}

export function useGeneData() {
  const [targetGenes, setTargetGenes] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [loadedState, setLoadedState] = useState(null);
  const [readyCount, setReadyCount] = useState(0);

  const queries = useQueries({
    queries: targetGenes.map((gene, i) => ({
      queryKey: geneQueryKey(gene, activeFilters),
      queryFn: () => fetchGene(gene, activeFilters),
      staleTime: Infinity,
      gcTime: Infinity,
      enabled: i < readyCount,
    })),
  });

  // release the next gene query only after the current one settles + a short pause
  const currentStatus = queries[readyCount - 1]?.status;
  useEffect(() => {
    if (readyCount === 0 || readyCount >= targetGenes.length) return;
    if (currentStatus !== 'success' && currentStatus !== 'error') return;
    const t = setTimeout(() => setReadyCount((c) => c + 1), QUERY_STAGGER_MS);
    return () => clearTimeout(t);
  }, [currentStatus, readyCount, targetGenes.length]);

  const liveStatus = useMemo(() => {
    if (targetGenes.length === 0) return 'idle';
    if (queries.some((q) => q.isPending)) return 'loading';
    if (queries.some((q) => q.isError)) return 'error';
    return 'done';
  }, [targetGenes, queries]);

  const liveProgress = useMemo(
    () => ({
      done: queries.filter((q) => q.isSuccess).length,
      total: targetGenes.length,
    }),
    [queries, targetGenes]
  );

  const liveMaps = useMemo(() => {
    const geneMap = new Map();
    const cellTypeMap = new Map();
    queries.forEach((q, i) => {
      if (!q.isSuccess) return;
      const gene = targetGenes[i];
      geneMap.set(gene, new Map());
      for (const r of q.data) {
        const ct = r.celltypes;
        const rec = {
          cosg: Number(r.cosg_score) || 0,
          log2fc: Number(r.avg_log2fc) || 0,
          pct1: Number(r.pct1) || 0,
          pct2: Number(r.pct2) || 0,
        };
        if (!cellTypeMap.has(ct)) cellTypeMap.set(ct, new Map());
        // keep the strongest hit when a gene marks the same cell type in several studies
        const prev = geneMap.get(gene).get(ct);
        if (!prev || rec.cosg > prev.cosg) {
          geneMap.get(gene).set(ct, rec);
          cellTypeMap.get(ct).set(gene, rec);
        }
      }
    });
    return { geneMap, cellTypeMap };
  }, [queries, targetGenes]);

  const liveError = useMemo(() => {
    const errQuery = queries.find((q) => q.isError);
    return errQuery?.error?.message ?? null;
  }, [queries]);

  const search = useCallback((genes, filters) => {
    setLoadedState(null);
    setTargetGenes(genes);
    setActiveFilters(filters);
    setReadyCount(genes.length > 0 ? 1 : 0);
  }, []);

  const loadResults = useCallback((serialized) => {
    setTargetGenes([]);
    setActiveFilters({});
    setReadyCount(0);
    setLoadedState(deserializeResults(serialized));
  }, []);

  const clear = useCallback(() => {
    setTargetGenes([]);
    setActiveFilters({});
    setReadyCount(0);
    setLoadedState(null);
  }, []);

  if (loadedState) {
    return {
      status: 'done',
      progress: { done: 0, total: 0 },
      geneMap: loadedState.geneMap,
      cellTypeMap: loadedState.cellTypeMap,
      error: null,
      search,
      loadResults,
      clear,
    };
  }

  return {
    status: liveStatus,
    progress: liveProgress,
    geneMap: liveMaps.geneMap,
    cellTypeMap: liveMaps.cellTypeMap,
    error: liveError,
    search,
    loadResults,
    clear,
  };
}
