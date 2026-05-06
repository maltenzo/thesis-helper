import { useState, useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchGene } from './api';

export function serializeResults(geneMap, cellTypeMap) {
  return {
    geneMap: Object.fromEntries([...geneMap.entries()].map(([g, s]) => [g, [...s]])),
    cellTypeMap: Object.fromEntries([...cellTypeMap.entries()].map(([ct, s]) => [ct, [...s]])),
  };
}

export function deserializeResults({ geneMap, cellTypeMap }) {
  return {
    geneMap: new Map(Object.entries(geneMap).map(([g, arr]) => [g, new Set(arr)])),
    cellTypeMap: new Map(Object.entries(cellTypeMap).map(([ct, arr]) => [ct, new Set(arr)])),
  };
}

function geneQueryKey(gene, filters) {
  return ['gene', gene, !!filters.highConfidence, !!filters.singleCell, !!filters.uniqueGenes];
}

export function useGeneData() {
  const [targetGenes, setTargetGenes] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [loadedState, setLoadedState] = useState(null);

  const queries = useQueries({
    queries: targetGenes.map((gene) => ({
      queryKey: geneQueryKey(gene, activeFilters),
      queryFn: () => fetchGene(gene, activeFilters),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  });

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
      const cellTypes = new Set();
      for (const r of q.data) {
        cellTypes.add(r.celltypes);
        if (!cellTypeMap.has(r.celltypes)) cellTypeMap.set(r.celltypes, new Set());
        cellTypeMap.get(r.celltypes).add(gene);
      }
      geneMap.set(gene, cellTypes);
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
  }, []);

  const loadResults = useCallback((serialized) => {
    setTargetGenes([]);
    setActiveFilters({});
    setLoadedState(deserializeResults(serialized));
  }, []);

  const clear = useCallback(() => {
    setTargetGenes([]);
    setActiveFilters({});
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
