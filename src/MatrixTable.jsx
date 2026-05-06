import { useMemo, useState } from 'react';

export function MatrixTable({ geneMap, cellTypeMap, onSelectGene, onSelectCellType }) {
  const [selectedCellTypes, setSelectedCellTypes] = useState(new Set());
  const [hideUbiquitous, setHideUbiquitous] = useState(false);
  const [sortBy, setSortBy] = useState('count'); // 'count' | 'name'

  const genes = useMemo(() => [...geneMap.keys()].sort(), [geneMap]);

  const cellTypes = useMemo(() => {
    const total = genes.length;
    let cts = [...cellTypeMap.entries()];
    if (hideUbiquitous) cts = cts.filter(([, gSet]) => gSet.size < total);
    if (sortBy === 'count') cts.sort((a, b) => b[1].size - a[1].size);
    else cts.sort((a, b) => a[0].localeCompare(b[0]));
    return cts.map(([ct]) => ct);
  }, [cellTypeMap, genes, hideUbiquitous, sortBy]);

  const intersection = useMemo(() => {
    if (selectedCellTypes.size === 0) return null;
    const sets = [...selectedCellTypes].map((ct) => cellTypeMap.get(ct) || new Set());
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
      const cells = cellTypes.map((ct) => (geneMap.get(g)?.has(ct) ? '1' : '0'));
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
            <option value="count">Sort by count</option>
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
                    <span className="ct-count">{cellTypeMap.get(ct)?.size ?? 0}</span>
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
                  {cellTypes.map((ct) => (
                    <td
                      key={ct}
                      className={`matrix-cell ${geneMap.get(gene)?.has(ct) ? 'present' : 'absent'} ${selectedCellTypes.has(ct) ? 'col-selected' : ''}`}
                    >
                      {geneMap.get(gene)?.has(ct) ? '✔' : ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
