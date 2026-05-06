import { useState } from 'react';

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

export function SavedClusterList({ clusters, onLoad, onDelete }) {
  if (clusters.length === 0) return null;

  return (
    <div className="saved-clusters">
      <div className="saved-clusters-label">Saved clusters</div>
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
