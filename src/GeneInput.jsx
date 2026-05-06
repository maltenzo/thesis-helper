import { useState, useImperativeHandle, forwardRef } from 'react';

export const GeneInput = forwardRef(function GeneInput({ onSearch, onInputChange, loading }, ref) {
  const [text, setText] = useState('');
  const [highConfidence, setHighConfidence] = useState(false);
  const [singleCell, setSingleCell] = useState(false);
  const [uniqueGenes, setUniqueGenes] = useState(false);

  useImperativeHandle(ref, () => ({
    load(genes, filters) {
      setText(genes.join('\n'));
      setHighConfidence(filters.highConfidence ?? false);
      setSingleCell(filters.singleCell ?? false);
      setUniqueGenes(filters.uniqueGenes ?? false);
    },
    reset() {
      setText('');
      setHighConfidence(false);
      setSingleCell(false);
      setUniqueGenes(false);
    },
  }));

  function parseGenes(raw) {
    return [...new Set(raw.split(/[\s,;]+/).map((g) => g.trim().toUpperCase()).filter(Boolean))];
  }

  function handleSubmit(e) {
    e.preventDefault();
    const genes = parseGenes(text);
    if (genes.length === 0) return;
    const filters = { highConfidence, singleCell, uniqueGenes };
    onSearch(genes, filters);
  }

  function handleTextChange(e) {
    setText(e.target.value);
    if (onInputChange) onInputChange(parseGenes(e.target.value), { highConfidence, singleCell, uniqueGenes });
  }

  return (
    <form onSubmit={handleSubmit} className="gene-input">
      <label className="input-label">
        Genes (one per line, or comma/space separated)
      </label>
      <textarea
        value={text}
        onChange={handleTextChange}
        placeholder={'AT1G79840\nAT2G00930\nAT3G11260'}
        rows={6}
        className="gene-textarea"
        disabled={loading}
      />
      <div className="filters">
        <label>
          <input type="checkbox" checked={highConfidence} onChange={(e) => setHighConfidence(e.target.checked)} disabled={loading} />
          High confidence only
        </label>
        <label>
          <input type="checkbox" checked={singleCell} onChange={(e) => setSingleCell(e.target.checked)} disabled={loading} />
          Single cell only
        </label>
        <label>
          <input type="checkbox" checked={uniqueGenes} onChange={(e) => setUniqueGenes(e.target.checked)} disabled={loading} />
          Unique genes only
        </label>
      </div>
      <button type="submit" disabled={loading || !text.trim()} className="search-btn">
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
});
