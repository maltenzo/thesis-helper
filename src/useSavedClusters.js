import { useState, useCallback } from 'react';
import { compressToBase64, decompressFromBase64 } from 'lz-string';

const STORAGE_KEY = 'plantscrna_clusters';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persist(clusters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clusters));
}

export function useSavedClusters() {
  const [clusters, setClusters] = useState(load);

  const save = useCallback((name, genes, filters, notes = '', results = null) => {
    setClusters((prev) => {
      const next = [
        { id: Date.now(), name, genes, filters, notes, results, savedAt: new Date().toISOString() },
        ...prev.filter((c) => c.name !== name),
      ];
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setClusters((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const toBase64 = useCallback(() => {
    return compressToBase64(JSON.stringify(clusters));
  }, [clusters]);

  const fromBase64 = useCallback((str) => {
    const json = decompressFromBase64(str.trim());
    if (!json) throw new Error('Invalid or corrupted string');
    const imported = JSON.parse(json);
    if (!Array.isArray(imported)) throw new Error('Invalid format');
    setClusters((prev) => {
      const kept = prev.filter((c) => !imported.some((ic) => ic.name === c.name));
      const next = [...imported, ...kept];
      persist(next);
      return next;
    });
    return imported.length;
  }, []);

  const sortedClusters = [...clusters].sort((a, b) => b.id - a.id);
  return { clusters: sortedClusters, save, remove, toBase64, fromBase64 };
}
