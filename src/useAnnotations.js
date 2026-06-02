import { useState, useCallback } from 'react';

const STORAGE_KEY = 'thesis_cluster_annotations';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function persist(a) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

export function useAnnotations() {
  const [annotations, setAnnotations] = useState(load);

  const set = useCallback((id, cellType) => {
    setAnnotations(prev => {
      const next = { ...prev, [String(id)]: cellType };
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setAnnotations(prev => {
      const next = { ...prev };
      delete next[String(id)];
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setAnnotations({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setBulk = useCallback((map) => {
    setAnnotations(prev => {
      const next = { ...prev, ...map };
      persist(next);
      return next;
    });
  }, []);

  return { annotations, set, setBulk, remove, clearAll };
}
