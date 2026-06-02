import { describe, it, expect } from 'vitest';
import { runBootstrap } from './useAutopilot.js';

// Deterministic rng: cycles through [0, 0.1, 0.2, ...] to make shuffles predictable
function seededRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// All genes → single cell type: every iteration should pick it
const monoData = {
  SCR:  new Set(['Endodermis']),
  SHR:  new Set(['Endodermis']),
  WOX5: new Set(['Endodermis']),
  PLT1: new Set(['Endodermis']),
  PLT2: new Set(['Endodermis']),
};
const monoGenes = Object.keys(monoData);

describe('runBootstrap', () => {
  it('all genes point to one cell type → confidence = 1.0', () => {
    const result = runBootstrap(monoData, monoGenes, { nIterations: 20, dropM: 1 });
    expect(result[0].cellType).toBe('Endodermis');
    expect(result[0].confidence).toBeCloseTo(1.0);
  });

  it('returns at most 3 suggestions', () => {
    const data = {
      G1: new Set(['A']), G2: new Set(['B']), G3: new Set(['C']),
      G4: new Set(['D']), G5: new Set(['A']),
    };
    const result = runBootstrap(data, Object.keys(data), { nIterations: 20, dropM: 0 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('dropM = 0 uses all genes every iteration → deterministic result', () => {
    const rng = seededRng([0.1, 0.2, 0.3, 0.4, 0.5]);
    const result = runBootstrap(monoData, monoGenes, { nIterations: 10, dropM: 0, rng });
    expect(result[0].cellType).toBe('Endodermis');
    expect(result[0].confidence).toBeCloseTo(1.0);
  });

  it('confidence reflects split: two equally-dominant types share wins', () => {
    // 3 genes → A, 3 genes → B, no gene → both; with dropM=0 A and B tie every iter
    const splitData = {
      G1: new Set(['A']), G2: new Set(['A']), G3: new Set(['A']),
      G4: new Set(['B']), G5: new Set(['B']), G6: new Set(['B']),
    };
    const result = runBootstrap(splitData, Object.keys(splitData), {
      nIterations: 100, dropM: 0,
    });
    // Both A and B should appear; their confidences should sum close to 1
    const total = result.reduce((s, r) => s + r.confidence, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });

  it('returns empty array when geneData has no cell types', () => {
    const empty = { G1: new Set(), G2: new Set() };
    const result = runBootstrap(empty, ['G1', 'G2'], { nIterations: 5, dropM: 0 });
    expect(result).toEqual([]);
  });

  it('dropM capped at geneNames.length - 1 (always keeps ≥1 gene)', () => {
    // dropM = 100, but only 3 genes → effectiveDrop = 2, 1 gene remains
    const result = runBootstrap(monoData, ['SCR', 'SHR', 'WOX5'], {
      nIterations: 10, dropM: 100,
    });
    expect(result[0].cellType).toBe('Endodermis');
  });

  it('majority wins: 4 genes → A vs 1 gene → B → A dominates', () => {
    const data = {
      G1: new Set(['A']), G2: new Set(['A']),
      G3: new Set(['A']), G4: new Set(['A']),
      G5: new Set(['B']),
    };
    const result = runBootstrap(data, Object.keys(data), { nIterations: 50, dropM: 0 });
    expect(result[0].cellType).toBe('A');
    expect(result[0].confidence).toBeGreaterThan(0.8);
  });

  it('avgScore is between 0 and 1', () => {
    const result = runBootstrap(monoData, monoGenes, { nIterations: 10, dropM: 1 });
    for (const s of result) {
      expect(s.avgScore).toBeGreaterThan(0);
      expect(s.avgScore).toBeLessThanOrEqual(1);
    }
  });
});
