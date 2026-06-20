import { useMemo, useState } from 'react';

export function MatrixTable({ geneMap, cellTypeMap, onSelectGene, onSelectCellType }) {
  const [selectedCellTypes, setSelectedCellTypes] = useState(new Set());
  const [hideUbiquitous, setHideUbiquitous] = useState(false);
  const [sortBy, setSortBy] = useState('score'); // 'score' | 'name'

  const genes = useMemo(() => [...geneMap.keys()].sort(), [geneMap]);

  // cell-type weight = sum of cosg specificity scores of the genes that mark it
  const ctWeight = (m) => [...m.values()].reduce((s, r) => s + r.cosg, 0);

  const cellTypes = useMemo(() => {
    const total = genes.length;
    let cts = [...cellTypeMap.entries()];
    if (hideUbiquitous) cts = cts.filter(([, gMap]) => gMap.size < total);
    if (sortBy === 'score') cts.sort((a, b) => ctWeight(b[1]) - ctWeight(a[1]));
    else cts.sort((a, b) => a[0].localeCompare(b[0]));
    return cts.map(([ct]) => ct);
  }, [cellTypeMap, genes, hideUbiquitous, sortBy]);

  const intersection = useMemo(() => {
    if (selectedCellTypes.size === 0) return null;
    const sets = [...selectedCellTypes].map((ct) => new Set(cellTypeMap.get(ct)?.keys() || []));
    return sets.reduce((acc, s) => new Set([...acc].filter((g) => s.has(g))));
  }, [selectedCellTypes, cellTypeMap]);

  function toggleCellType(ct) {
    setSelectedCellTypes((prev) => {
      const next = new Set(prev);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }

  function exportCSV() {
    const header = ['Gene', ...cellTypes].join(',');
    const rows = genes.map((g) => {
      const cells = cellTypes.map((ct) => geneMap.get(g)?.get(ct)?.cosg.toFixed(4) ?? '0');
      return [g, ...cells].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gene_celltype_matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (genes.length === 0) return null;

  return (
    <div className="matrix-section">
      <div className="matrix-toolbar">
        <span className="matrix-stats">
          {genes.length} genes × {cellTypes.length} cell types
          {intersection && (
            <span className="intersection-badge">
              {' '}| Intersection: {intersection.size} genes
            </span>
          )}
        </span>
        <div className="toolbar-controls">
          <label>
            <input type="checkbox" checked={hideUbiquitous} onChange={(e) => setHideUbiquitous(e.target.checked)} />
            Hide ubiquitous
          </label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">Sort by specificity</option>
            <option value="name">Sort by name</option>
          </select>
          <button onClick={() => setSelectedCellTypes(new Set())} disabled={selectedCellTypes.size === 0}>
            Clear selection
          </button>
          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {intersection && intersection.size > 0 && (
        <div className="intersection-panel">
          <strong>Genes in all selected cell types:</strong>{' '}
          {[...intersection].join(', ')}
        </div>
      )}

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="gene-col-header">Gene</th>
              {cellTypes.map((ct) => (
                <th
                  key={ct}
                  className={`ct-header ${selectedCellTypes.has(ct) ? 'selected' : ''}`}
                  onClick={() => {
                    toggleCellType(ct);
                    onSelectCellType(ct);
                  }}
                  title={ct}
                >
                  <div className="ct-header-inner">
                    <span className="ct-name">{ct}</span>
                    <span className="ct-count" title={`${cellTypeMap.get(ct)?.size ?? 0} genes`}>
                      {ctWeight(cellTypeMap.get(ct) || new Map()).toFixed(1)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {genes.map((gene) => {
              const inIntersection = intersection ? intersection.has(gene) : false;
              return (
                <tr
                  key={gene}
                  className={inIntersection ? 'intersection-row' : ''}
                  onClick={() => onSelectGene(gene)}
                >
                  <td className="gene-cell">{gene}</td>
                  {cellTypes.map((ct) => {
                    const rec = geneMap.get(gene)?.get(ct);
                    return (
                      <td
                        key={ct}
                        className={`matrix-cell ${rec ? 'present' : 'absent'} ${selectedCellTypes.has(ct) ? 'col-selected' : ''}`}
                        style={rec ? { backgroundColor: `rgba(34,139,87,${Math.min(1, 0.2 + rec.cosg)})` } : undefined}
                        title={rec ? `cosg ${rec.cosg.toFixed(3)} · log2FC ${rec.log2fc.toFixed(2)} · pct ${rec.pct1}/${rec.pct2}` : undefined}
                      >
                        {rec ? rec.cosg.toFixed(2) : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
