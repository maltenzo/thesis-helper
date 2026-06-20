export function DetailPanel({ selectedGene, selectedCellType, geneMap, cellTypeMap, onClose }) {
  if (!selectedGene && !selectedCellType) return null;

  let title, recMap;
  if (selectedGene) {
    title = `Cell types for ${selectedGene}`;
    recMap = geneMap.get(selectedGene);
  } else {
    title = `Genes in ${selectedCellType}`;
    recMap = cellTypeMap.get(selectedCellType);
  }

  // strongest markers first
  const items = [...(recMap || new Map())].sort((a, b) => b[1].cosg - a[1].cosg);

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <strong>{title}</strong>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="detail-count">{items.length} found</div>
      <ul className="detail-list">
        {items.map(([name, rec]) => (
          <li key={name}>
            <span className="detail-name">{name}</span>
            <span className="detail-metrics">
              cosg {rec.cosg.toFixed(2)} · log2FC {rec.log2fc.toFixed(2)} · pct {rec.pct1}/{rec.pct2}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
