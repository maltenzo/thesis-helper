export function DetailPanel({ selectedGene, selectedCellType, geneMap, cellTypeMap, onClose }) {
  if (!selectedGene && !selectedCellType) return null;

  let title, items;
  if (selectedGene) {
    title = `Cell types for ${selectedGene}`;
    items = [...(geneMap.get(selectedGene) || [])].sort();
  } else {
    title = `Genes in ${selectedCellType}`;
    items = [...(cellTypeMap.get(selectedCellType) || [])].sort();
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <strong>{title}</strong>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="detail-count">{items.length} found</div>
      <ul className="detail-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
