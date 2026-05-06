import { useState, useCallback } from 'react';
import { fetchGene, clearCache } from './api';

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

export function useGeneData() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [geneMap, setGeneMap] = useState(new Map());
  const [cellTypeMap, setCellTypeMap] = useState(new Map());
  const [error, setError] = useState(null);

  const search = useCallback(async (genes, filters) => {
    clearCache();
    setStatus('loading');
    setProgress({ done: 0, total: genes.length });
    setError(null);

    const newGeneMap = new Map();
    const newCellTypeMap = new Map();

    try {
      for (const gene of genes) {
        const records = await fetchGene(gene, filters);

        const cellTypes = new Set();
        for (const r of records) {
          cellTypes.add(r.celltypes);
          if (!newCellTypeMap.has(r.celltypes)) newCellTypeMap.set(r.celltypes, new Set());
          newCellTypeMap.get(r.celltypes).add(gene);
        }
        newGeneMap.set(gene, cellTypes);

        setProgress((p) => ({ ...p, done: p.done + 1 }));
        await new Promise((r) => setTimeout(r, 0));
      }

      setGeneMap(new Map(newGeneMap));
      setCellTypeMap(new Map(newCellTypeMap));
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  const loadResults = useCallback((serialized) => {
    const { geneMap: gm, cellTypeMap: ctm } = deserializeResults(serialized);
    setGeneMap(gm);
    setCellTypeMap(ctm);
    setError(null);
    setStatus('done');
  }, []);

  const clear = useCallback(() => {
    setGeneMap(new Map());
    setCellTypeMap(new Map());
    setStatus('idle');
    setError(null);
  }, []);

  return { status, progress, geneMap, cellTypeMap, error, search, loadResults, clear };
}
