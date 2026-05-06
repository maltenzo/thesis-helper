import { useState, useCallback } from 'react';

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

  return { clusters, save, remove };
}
