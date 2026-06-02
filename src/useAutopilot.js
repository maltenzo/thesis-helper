import { useState, useCallback } from 'react';
import { fetchGene } from './api';

// Pure bootstrap logic — exported for tests.
// geneData: { geneName: Set<cellType> }
// geneNames: string[]
// Returns top-3 suggestions sorted by confidence.
export function runBootstrap(geneData, geneNames, { nIterations = 10, dropM = 5, rng = Math.random } = {}) {
  const effectiveDrop = Math.min(dropM, geneNames.length - 1);
  const wins = {}, totals = {};

  for (let i = 0; i < nIterations; i++) {
    const shuffled = [...geneNames].sort(() => rng() - 0.5);
    const subset   = shuffled.slice(effectiveDrop);

    const ctScore = {};
    for (const gene of subset)
      for (const ct of (geneData[gene] ?? []))
        ctScore[ct] = (ctScore[ct] ?? 0) + 1;

    const winner = Object.entries(ctScore).sort((a, b) => b[1] - a[1])[0];
    if (winner) {
      wins[winner[0]]   = (wins[winner[0]]   ?? 0) + 1;
      totals[winner[0]] = (totals[winner[0]] ?? 0) + winner[1] / subset.length;
    }
  }

  return Object.entries(wins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ct, w]) => ({
      cellType:   ct,
      confidence: w / nIterations,
      avgScore:   (totals[ct] ?? 0) / w,
    }));
}

export function useAutopilot() {
  const [status, setStatus]     = useState('idle'); // idle | fetching | iterating | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  const run = useCallback(async (deGenes, { nIterations = 10, dropM = 5 } = {}) => {
    setStatus('fetching');
    setResult(null);
    setError(null);

    const geneNames = deGenes.slice(0, 30).map(g => g.name);
    setProgress({ done: 0, total: geneNames.length });

    // Fetch all genes in parallel (concurrency-limited to avoid hammering the API)
    const CONCURRENCY = 5;
    const geneData = {}; // gene → Set<cellType>
    const queue = [...geneNames];
    let done = 0;

    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      await Promise.all(batch.map(async gene => {
        try {
          const records = await fetchGene(gene, {});
          geneData[gene] = new Set(records.map(r => r.celltypes));
        } catch {
          geneData[gene] = new Set();
        }
        done += 1;
        setProgress({ done, total: geneNames.length });
      }));
    }

    setStatus('iterating');

    const effectiveDrop = Math.min(dropM, geneNames.length - 1);
    const suggestions = runBootstrap(geneData, geneNames, { nIterations, dropM });

    setResult({
      suggestions,
      nIterations,
      dropM: effectiveDrop,
      genesQueried: geneNames.length,
    });
    setStatus('done');
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  }, []);

  return { status, progress, result, error, run, reset };
}
