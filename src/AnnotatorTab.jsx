import { useState } from 'react';
import { parseScoringCsv, parseDeCsv, cleanLabel } from './parseCsv';
import { useAnnotations } from './useAnnotations';

const CELL_TYPES = [
  'QC', 'Columella', 'LRC', 'Trichoblast', 'Atrichoblast',
  'Endodermis', 'Cortex', 'Phloem', 'Xylem', 'Stele tissue',
  'Procambium', 'XPP', 'PPP', 'Pericycle', 'Meristematic',
  'Ground tissue', 'Unassigned',
];

export function AnnotatorTab({ onSendToExplorer }) {
  const { annotations, set: annotate, remove: unannotate, clearAll } = useAnnotations();
  const [clusters, setClusters] = useState([]);
  const [clusterKey, setClusterKey] = useState('');
  const [deGenes, setDeGenes] = useState(new Map());
  const [selectedId, setSelectedId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentRes, setCurrentRes] = useState(null);

  function resKey(id) {
    return currentRes ? `${currentRes}__${id}` : id;
  }

  function handleScoringFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const resMatch = file.name.match(/leiden_(\d+(?:\.\d+)?)/);
    setCurrentRes(resMatch ? resMatch[1] : null);
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseScoringCsv(ev.target.result);
      if (!rows.length) return;
      setClusters(rows);
      setClusterKey(Object.keys(rows[0])[0]);
      setSelectedId(null);
      setInputValue('');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleDeFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setDeGenes(parseDeCsv(ev.target.result));
    reader.readAsText(file);
    e.target.value = '';
  }

  function selectCluster(id) {
    setSelectedId(id);
    setInputValue(annotations[resKey(id)] ?? annotations[id] ?? '');
    setShowExport(false);
  }

  function handleAssign() {
    if (!selectedId || !inputValue.trim()) return;
    const trimmed = inputValue.trim();
    const key = resKey(String(selectedId));
    annotate(key, trimmed);
    // auto-advance to next unannotated cluster
    const newAnnotations = { ...annotations, [key]: trimmed };
    const ids = clusters.map(r => String(r[clusterKey]));
    const currentIdx = ids.indexOf(String(selectedId));
    const next = ids.slice(currentIdx + 1).find(id => !newAnnotations[resKey(id)]);
    if (next) {
      setSelectedId(next);
      setInputValue('');
    }
  }

  function handleExport() {
    const lines = clusters.map(row => {
      const id = row[clusterKey];
      const ann = annotations[resKey(String(id))] ?? annotations[String(id)];
      return ann ? `    ${id}: '${ann}',` : `    # ${id}: '',  # TODO`;
    });
    const dict = `combined_insights = {\n${lines.join('\n')}\n}`;
    setExportText(dict);
    setShowExport(true);
    setCopied(false);
    navigator.clipboard.writeText(dict).catch(() => {});
  }

  function handleCopy() {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const annotatedCount = clusters.filter(r => annotations[resKey(String(r[clusterKey]))] ?? annotations[String(r[clusterKey])]).length;
  const selectedRow = clusters.find(r => String(r[clusterKey]) === String(selectedId));
  const topDeGenes = selectedId
    ? (deGenes.get(String(selectedId)) ?? deGenes.get(String(parseInt(selectedId))) ?? [])
    : [];

  return (
    <>
      <aside className="sidebar">
        <div className="annotator-upload">
          <label className="upload-file-label">
            Scoring CSV
            <input type="file" accept=".csv" onChange={handleScoringFile} />
          </label>
          <label className="upload-file-label secondary">
            DE genes CSV <span className="upload-optional">(optional)</span>
            <input type="file" accept=".csv" onChange={handleDeFile} />
          </label>
          {deGenes.size > 0 && (
            <span className="de-loaded-badge">{deGenes.size} clusters with DE genes</span>
          )}
        </div>

        {clusters.length > 0 && (
          <>
            <div className="annotator-progress">
              <span className="ann-progress-label">
                {annotatedCount} / {clusters.length} annotated
                {currentRes && (
                  <span className="res-badge">leiden_{currentRes}</span>
                )}
              </span>
              <div className="ann-progress-track">
                <div
                  className="ann-progress-fill"
                  style={{ width: `${(annotatedCount / clusters.length) * 100}%` }}
                />
              </div>
            </div>

            <ul className="annotator-cluster-list">
              {clusters.map(row => {
                const id = String(row[clusterKey]);
                const ann = annotations[resKey(id)] ?? annotations[id];
                const isSelected = String(selectedId) === id;
                return (
                  <li
                    key={id}
                    className={`ann-cluster-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectCluster(id)}
                  >
                    <span className={`ann-dot ${ann ? 'annotated' : 'empty'}`} />
                    <span className="ann-cluster-id">{id}</span>
                    <span className="ann-cluster-type">{ann ?? '—'}</span>
                    <span className="ann-cluster-cells">{row.n_cells}c</span>
                  </li>
                );
              })}
            </ul>

            <div className="annotator-footer-btns">
              <button className="export-dict-btn" onClick={handleExport}>
                Export Python dict
              </button>
              <button
                className="clear-ann-btn"
                onClick={() => { if (window.confirm('Clear all annotations?')) clearAll(); }}
              >
                Clear all
              </button>
            </div>
          </>
        )}
      </aside>

      <section className="matrix-area annotator-main" style={{ position: 'relative' }}>
        {clusters.length === 0 && (
          <div className="empty-state">
            Upload <code>cluster_scoring_leiden_X.csv</code><br />
            or <code>preliminary_vs_manual_annotation_leiden_X.csv</code>
          </div>
        )}

        {clusters.length > 0 && !selectedRow && (
          <div className="empty-state">Select a cluster from the list.</div>
        )}

        {selectedRow && (
          <ClusterDetail
            row={selectedRow}
            clusterKey={clusterKey}
            annotations={annotations}
            currentRes={currentRes}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onAssign={handleAssign}
            onUnannotate={() => unannotate(resKey(String(selectedRow[clusterKey])))}
            topDeGenes={topDeGenes}
            onSendToExplorer={onSendToExplorer}
            hasDeData={deGenes.size > 0}
          />
        )}

        {showExport && (
          <div className="export-overlay">
            <div className="export-overlay-header">
              <strong>combined_insights — Python dict</strong>
              <div className="export-overlay-actions">
                <button className="copy-export-btn" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="close-btn" onClick={() => setShowExport(false)}>×</button>
              </div>
            </div>
            <pre className="export-pre">{exportText}</pre>
          </div>
        )}
      </section>
    </>
  );
}

function ClusterDetail({
  row, clusterKey, annotations, currentRes, inputValue, onInputChange,
  onAssign, onUnannotate, topDeGenes, onSendToExplorer, hasDeData,
}) {
  const id = String(row[clusterKey]);
  const key = currentRes ? `${currentRes}__${id}` : id;
  const currentAnn = annotations[key] ?? annotations[id];

  const topScores = [];
  for (let n = 1; n <= 5; n++) {
    const type = row[`Top_${n}_type`];
    const score = parseFloat(row[`Top_${n}_score`]);
    if (type && !isNaN(score)) topScores.push({ type, score });
  }
  const maxScore = Math.max(topScores[0]?.score ?? 1, 0.001);

  const preliminary = row.preliminary_label ?? row.prelim_label ?? null;
  const manual = row.manual_label ?? null;

  return (
    <div className="cluster-detail">
      <div className="cluster-detail-header">
        <h2>Cluster {id}</h2>
        <span className="cluster-detail-cells">{row.n_cells} cells</span>
        {currentAnn && <span className="cluster-ann-badge">{currentAnn}</span>}
      </div>

      {topScores.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Top scores</div>
          <div className="score-bars">
            {topScores.map(({ type, score }) => {
              const pct = Math.max(0, (score / maxScore) * 100);
              const color = score > 0.2 ? '#68d391' : score > 0.05 ? '#f6e05e' : '#4a5568';
              return (
                <div key={type} className="score-row">
                  <span className="score-type">{type}</span>
                  <div className="score-bar-track">
                    <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="score-val" style={{ color }}>{score.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(preliminary || manual) && (
        <div className="detail-section">
          <div className="detail-section-title">Existing annotations</div>
          {preliminary && (
            <div className="prev-ann-row">
              <span className="prev-ann-source">Auto</span>
              <span className="prev-ann-value">{preliminary}</span>
              <button
                className="use-ann-btn"
                onClick={() => onInputChange(cleanLabel(preliminary))}
              >
                Use
              </button>
            </div>
          )}
          {manual && (
            <div className="prev-ann-row">
              <span className="prev-ann-source">Manual</span>
              <span className="prev-ann-value">{manual}</span>
              <button
                className="use-ann-btn"
                onClick={() => onInputChange(cleanLabel(manual))}
              >
                Use
              </button>
            </div>
          )}
        </div>
      )}

      <div className="detail-section">
        <div className="detail-section-title">Assign cell type</div>
        <div className="annotation-input-row">
          <input
            list="cell-type-list"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAssign(); }}
            placeholder="Type or select…"
            className="annotation-input"
            autoComplete="off"
          />
          <datalist id="cell-type-list">
            {CELL_TYPES.map(ct => <option key={ct} value={ct} />)}
          </datalist>
          <button
            className="assign-btn"
            onClick={onAssign}
            disabled={!inputValue.trim()}
          >
            Assign →
          </button>
        </div>
        {currentAnn && (
          <button className="unannotate-btn" onClick={onUnannotate}>
            Remove annotation
          </button>
        )}
      </div>

      {hasDeData && (
        <div className="detail-section">
          <div className="detail-section-title">
            Top DE genes
            {topDeGenes.length > 0 && (
              <span className="de-count"> ({topDeGenes.length})</span>
            )}
          </div>
          {topDeGenes.length === 0 ? (
            <span className="de-empty">No DE data for this cluster.</span>
          ) : (
            <>
              <div className="de-table-header">
                <span className="de-col-rank">#</span>
                <span className="de-col-gene">Gene</span>
                <span
                  className="de-col-zscore"
                  title="Z-score de Wilcoxon: fuerza estadística de la diferenciación. Valores > 20 indican marcadores muy robustos. Es el criterio de ordenamiento principal."
                >
                  z-score ⓘ
                </span>
                <span
                  className="de-col-logfc"
                  title="log2 fold change vs resto de células. >1 = expresión doble, >2 = 4×. Magnitud biológica, independiente del z-score."
                >
                  logFC ⓘ
                </span>
                <span
                  className="de-col-pct"
                  title="% de células del cluster que expresan el gen (counts > 0). Alto % = expresión consistente, no solo en pocas células."
                >
                  % expr ⓘ
                </span>
              </div>
              <div className="de-table">
                {topDeGenes.slice(0, 30).map((g, i) => (
                  <div key={g.name} className="de-row">
                    <span className="de-rank">{i + 1}</span>
                    <span className="de-gene-name">{g.name}</span>
                    {g.zscore != null && (
                      <span className="de-zscore">{g.zscore.toFixed(1)}</span>
                    )}
                    {g.logFC != null && (
                      <span className="de-logfc">
                        {g.logFC > 0 ? '+' : ''}{g.logFC.toFixed(2)}
                      </span>
                    )}
                    {g.pct != null && (
                      <span className="de-pct">
                        {(g.pct * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
                {topDeGenes.length > 30 && (
                  <span className="de-more">+{topDeGenes.length - 30} more</span>
                )}
              </div>
              <button
                className="search-de-btn"
                onClick={() => onSendToExplorer(topDeGenes.slice(0, 30).map(g => g.name))}
              >
                Search top 30 in Explorer →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
