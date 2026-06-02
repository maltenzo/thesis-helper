import { describe, it, expect } from 'vitest';
import { computeHighlightedLinks, computeLabelTransfer, computePurityScores } from './SankeyTab.jsx';

// Helper to build a link object (only the fields BFS uses)
function link(fromRes, fromId, toRes, toId) {
  return { fromRes, fromId, toRes, toId, count: 10, x1:0,y1:0,h1:1,x2:1,y2:0,h2:1,color:'#fff' };
}

// Scenario: three Sankeys chained
//   0.3 → 0.5 → 0.7
//   Cluster 1 in 0.3 splits into 2 and 3 in 0.5
//   Cluster 2 in 0.5 goes to 4 in 0.7
//   Cluster 3 in 0.5 goes to 5 in 0.7
//   Cluster 9 in 0.1 feeds into cluster 1 in 0.3
//   Cluster 99 in 0.3 → 0.5 (unrelated, should NOT light up)
const links = [
  link('0.1', '9',  '0.3', '1'),  // 0 — upstream ancestor
  link('0.3', '1',  '0.5', '2'),  // 1 — forward split
  link('0.3', '1',  '0.5', '3'),  // 2 — forward split
  link('0.5', '2',  '0.7', '4'),  // 3 — downstream from 2
  link('0.5', '3',  '0.7', '5'),  // 4 — downstream from 3
  link('0.3', '99', '0.5', '6'),  // 5 — unrelated cluster in 0.3
  link('0.5', '6',  '0.7', '7'),  // 6 — unrelated downstream
];

describe('computeHighlightedLinks', () => {
  it('returns null when no node selected', () => {
    expect(computeHighlightedLinks(null, links)).toBeNull();
  });

  it('returns null when links array is empty', () => {
    expect(computeHighlightedLinks({ res: '0.3', id: '1' }, [])).toBeNull();
  });

  it('forward: cluster 1 (0.3) lights up splits into 0.5 and their 0.7 destinations', () => {
    const result = computeHighlightedLinks({ res: '0.3', id: '1' }, links);
    expect(result.has(1)).toBe(true); // 0.3__1 → 0.5__2
    expect(result.has(2)).toBe(true); // 0.3__1 → 0.5__3
    expect(result.has(3)).toBe(true); // 0.5__2 → 0.7__4
    expect(result.has(4)).toBe(true); // 0.5__3 → 0.7__5
  });

  it('backward: cluster 1 (0.3) also lights up its ancestor in 0.1', () => {
    const result = computeHighlightedLinks({ res: '0.3', id: '1' }, links);
    expect(result.has(0)).toBe(true); // 0.1__9 → 0.3__1
  });

  it('no fan-out: unrelated cluster 99 in 0.3 does NOT get highlighted', () => {
    const result = computeHighlightedLinks({ res: '0.3', id: '1' }, links);
    expect(result.has(5)).toBe(false); // 0.3__99 → 0.5__6
    expect(result.has(6)).toBe(false); // 0.5__6  → 0.7__7
  });

  it('clicking a mid-chain node (0.5__2) propagates forward and backward correctly', () => {
    const result = computeHighlightedLinks({ res: '0.5', id: '2' }, links);
    expect(result.has(1)).toBe(true); // 0.3__1 → 0.5__2 (backward)
    expect(result.has(0)).toBe(true); // 0.1__9 → 0.3__1 (backward x2)
    expect(result.has(3)).toBe(true); // 0.5__2 → 0.7__4 (forward)
    // sibling cluster 3 and its downstream should NOT appear
    expect(result.has(2)).toBe(false); // 0.3__1 → 0.5__3
    expect(result.has(4)).toBe(false); // 0.5__3 → 0.7__5
  });

  it('leaf node only highlights backward chain', () => {

    const result = computeHighlightedLinks({ res: '0.7', id: '4' }, links);
    expect(result.has(3)).toBe(true); // 0.5__2 → 0.7__4
    expect(result.has(1)).toBe(true); // 0.3__1 → 0.5__2
    expect(result.has(0)).toBe(true); // 0.1__9 → 0.3__1
    // unrelated paths still silent
    expect(result.has(2)).toBe(false);
    expect(result.has(4)).toBe(false);
  });
});

// ── computeLabelTransfer ──────────────────────────────────────────────
// Transitions: 0.3 → 0.5 → 1.0
// Cluster 1 in 0.3 → 80% to 1.0__A (Endodermis), 20% to 1.0__B (Cortex)
// Cluster 2 in 0.3 → 100% to 1.0__B (Cortex)
// Cluster 1 in 0.5 → 100% to 1.0__A (Endodermis) (intermediate)
// Cluster 2 in 0.5 → 100% to 1.0__B (Cortex)     (intermediate)

const transitions = [
  {
    resKey: '0.3_0.5', fromRes: '0.3', toRes: '0.5',
    links: [
      { from: '1', to: '1', count: 80 },
      { from: '1', to: '2', count: 20 },
      { from: '2', to: '2', count: 100 },
    ],
  },
  {
    resKey: '0.5_1.0', fromRes: '0.5', toRes: '1.0',
    links: [
      { from: '1', to: 'A', count: 100 },
      { from: '2', to: 'B', count: 100 },
    ],
  },
];

const sourceAnnotations = { A: 'Endodermis', B: 'Cortex' };

describe('computeLabelTransfer', () => {
  it('assigns majority annotation to each cluster', () => {
    const result = computeLabelTransfer(transitions, '1.0', sourceAnnotations);
    // 0.3__1: 80% → A (Endodermis), 20% → B (Cortex) → majority = Endodermis
    expect(result['0.3__1']).toBe('Endodermis');
    // 0.3__2: 100% → B (Cortex)
    expect(result['0.3__2']).toBe('Cortex');
    // 0.5__1: 100% → A (Endodermis)
    expect(result['0.5__1']).toBe('Endodermis');
    // 0.5__2: 100% → B (Cortex)
    expect(result['0.5__2']).toBe('Cortex');
  });

  it('does not include sourceRes clusters in result', () => {
    const result = computeLabelTransfer(transitions, '1.0', sourceAnnotations);
    expect(Object.keys(result).every(k => !k.startsWith('1.0__'))).toBe(true);
  });

  it('returns empty object when transitions are empty', () => {
    const result = computeLabelTransfer([], '1.0', sourceAnnotations);
    expect(result).toEqual({});
  });

  it('returns empty object when sourceAnnotations are empty', () => {
    const result = computeLabelTransfer(transitions, '1.0', {});
    expect(result).toEqual({});
  });

  it('proportional split: close majority wins', () => {
    // 51 cells → A, 49 cells → B → A wins
    const t = [{
      resKey: '0.3_1.0', fromRes: '0.3', toRes: '1.0',
      links: [{ from: '1', to: 'A', count: 51 }, { from: '1', to: 'B', count: 49 }],
    }];
    const result = computeLabelTransfer(t, '1.0', sourceAnnotations);
    expect(result['0.3__1']).toBe('Endodermis');
  });
});

// ── computePurityScores ───────────────────────────────────────────────
// Same transitions and sourceAnnotations as computeLabelTransfer tests.

describe('computePurityScores', () => {
  it('cluster with 100% of cells going to one type → purity = 1.0', () => {
    // 0.3__2: 100% → 0.5__2 → 1.0__B (Cortex) → purity = 1.0
    const result = computePurityScores(transitions, '1.0', sourceAnnotations);
    expect(result['0.3__2']).toBeCloseTo(1.0, 5);
  });

  it('cluster with 80/20 split → purity ≈ 0.8', () => {
    // 0.3__1: 80 cells → 0.5__1 → 1.0__A, 20 cells → 0.5__2 → 1.0__B
    // votes: { Endodermis: 0.8, Cortex: 0.2 } → purity = 0.8 / 1.0 = 0.8
    const result = computePurityScores(transitions, '1.0', sourceAnnotations);
    expect(result['0.3__1']).toBeCloseTo(0.8, 5);
  });

  it('cluster with 51/49 split → purity ≈ 0.51', () => {
    const t = [{
      resKey: '0.3_1.0', fromRes: '0.3', toRes: '1.0',
      links: [{ from: '1', to: 'A', count: 51 }, { from: '1', to: 'B', count: 49 }],
    }];
    const result = computePurityScores(t, '1.0', sourceAnnotations);
    expect(result['0.3__1']).toBeCloseTo(51 / 100, 5);
  });

  it('does not include sourceRes clusters in result', () => {
    const result = computePurityScores(transitions, '1.0', sourceAnnotations);
    expect(Object.keys(result).every(k => !k.startsWith('1.0__'))).toBe(true);
  });

  it('returns empty object when transitions are empty', () => {
    const result = computePurityScores([], '1.0', sourceAnnotations);
    expect(result).toEqual({});
  });

  it('returns empty object when sourceAnnotations are empty', () => {
    const result = computePurityScores(transitions, '1.0', {});
    expect(result).toEqual({});
  });

  it('intermediate clusters also get purity scores', () => {
    // 0.5__1: 100% → 1.0__A → purity = 1.0
    // 0.5__2: 100% → 1.0__B → purity = 1.0
    const result = computePurityScores(transitions, '1.0', sourceAnnotations);
    expect(result['0.5__1']).toBeCloseTo(1.0, 5);
    expect(result['0.5__2']).toBeCloseTo(1.0, 5);
  });
});
