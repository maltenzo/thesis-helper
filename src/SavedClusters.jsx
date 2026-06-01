import { useState, useRef } from 'react';

export function SaveCluster({ genes, filters, onSave }) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  function handleSave(e) {
    e.preventDefault();
    if (!name.trim() || genes.length === 0) return;
    onSave(name.trim(), genes, filters, notes.trim());
    setName('');
    setNotes('');
  }

  const disabled = genes.length === 0;

  return (
    <form onSubmit={handleSave} className="save-cluster-form">
      <div className="save-cluster-row">
        <input
          className="cluster-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cluster name…"
          disabled={disabled}
        />
        <button
          type="submit"
          className="save-cluster-btn"
          disabled={!name.trim() || disabled}
        >
          Save
        </button>
      </div>
      <textarea
        className="cluster-notes-input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Annotation / notes (optional)…"
        rows={2}
        disabled={disabled}
      />
    </form>
  );
}

export function SavedClusterList({ clusters, onLoad, onDelete, onExport, onImport }) {
  const [mode, setMode] = useState(null); // null | 'export' | 'import'
  const [exportStr, setExportStr] = useState('');
  const [importStr, setImportStr] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  function handleExport() {
    if (mode === 'export') { setMode(null); return; }
    setExportStr(onExport());
    setMode('export');
  }

  function handleImportToggle() {
    if (mode === 'import') { setMode(null); setImportStr(''); setImportError(''); return; }
    setMode('import');
  }

  function handleImport() {
    setImportError('');
    try {
      const count = onImport(importStr);
      setImportStr('');
      setMode(null);
      alert(`Imported ${count} cluster(s).`);
    } catch (e) {
      setImportError(e.message);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(exportStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (clusters.length === 0 && mode !== 'import') return (
    <div className="saved-clusters">
      <div className="saved-clusters-header">
        <span className="saved-clusters-label">Saved clusters</span>
        <button className="cluster-io-btn" onClick={handleImportToggle}>Import</button>
      </div>
      {mode === 'import' && (
        <div className="cluster-io-panel">
          <textarea
            className="cluster-io-textarea"
            value={importStr}
            onChange={(e) => setImportStr(e.target.value)}
            placeholder="Paste exported string here…"
            rows={4}
            ref={textareaRef}
          />
          {importError && <span className="cluster-io-error">{importError}</span>}
          <button className="cluster-io-confirm-btn" onClick={handleImport} disabled={!importStr.trim()}>
            Import
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="saved-clusters">
      <div className="saved-clusters-header">
        <span className="saved-clusters-label">Saved clusters</span>
        <div className="cluster-io-btns">
          <button className={`cluster-io-btn${mode === 'export' ? ' active' : ''}`} onClick={handleExport}>
            Export
          </button>
          <button className={`cluster-io-btn${mode === 'import' ? ' active' : ''}`} onClick={handleImportToggle}>
            Import
          </button>
        </div>
      </div>

      {mode === 'export' && (
        <div className="cluster-io-panel">
          <textarea
            className="cluster-io-textarea"
            value={exportStr}
            readOnly
            rows={4}
            onClick={(e) => e.target.select()}
          />
          <button className="cluster-io-confirm-btn" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {mode === 'import' && (
        <div className="cluster-io-panel">
          <textarea
            className="cluster-io-textarea"
            value={importStr}
            onChange={(e) => setImportStr(e.target.value)}
            placeholder="Paste exported string here…"
            rows={4}
          />
          {importError && <span className="cluster-io-error">{importError}</span>}
          <button className="cluster-io-confirm-btn" onClick={handleImport} disabled={!importStr.trim()}>
            Import
          </button>
        </div>
      )}

      <ul className="cluster-list">
        {clusters.map((c) => (
          <li key={c.id} className="cluster-item">
            <div className="cluster-info">
              <span className="cluster-name">{c.name}</span>
              <span className="cluster-meta">{c.genes.length} genes</span>
              {c.notes && <span className="cluster-notes">{c.notes}</span>}
            </div>
            <div className="cluster-actions">
              <button className="cluster-load-btn" onClick={() => onLoad(c)}>Load</button>
              <button className="cluster-delete-btn" onClick={() => onDelete(c.id)}>×</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
