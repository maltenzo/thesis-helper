import { test, expect } from 'vitest';
import { serializeResults, deserializeResults } from './useGeneData';

const rec = { cosg: 0.18, log2fc: 0.82, pct1: 0.25, pct2: 0.02 };

test('serialize/deserialize roundtrip keeps rec scores', () => {
  const geneMap = new Map([['AT1G79840', new Map([['Epidermis', rec]])]]);
  const cellTypeMap = new Map([['Epidermis', new Map([['AT1G79840', rec]])]]);
  const back = deserializeResults(serializeResults(geneMap, cellTypeMap));
  expect(back.geneMap.get('AT1G79840').get('Epidermis')).toEqual(rec);
  expect(back.cellTypeMap.get('Epidermis').get('AT1G79840')).toEqual(rec);
});

test('deserialize tolerates old presence-only string[] clusters', () => {
  const old = { geneMap: { AT1G79840: ['Epidermis'] }, cellTypeMap: { Epidermis: ['AT1G79840'] } };
  const back = deserializeResults(old);
  expect(back.geneMap.get('AT1G79840').get('Epidermis').cosg).toBe(0);
  expect(back.cellTypeMap.get('Epidermis').has('AT1G79840')).toBe(true);
});
