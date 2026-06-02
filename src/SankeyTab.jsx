import { useState, useMemo, useRef, useEffect } from 'react';
import { parseScoringCsv } from './parseCsv';
import { useAnnotations } from './useAnnotations';

// Parse a crosstab CSV: first col = from_cluster, rest = to_cluster counts
function parseTransitionCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim());
  const toIds = headers.slice(1); // to_cluster ids

  const rows = [];
  for (const line of lines.slice(1)) {
    const vals = line.split(',').map(v => v.trim());
    const fromId = vals[0];
    toIds.forEach((toId, i) => {
      const count = parseInt(vals[i + 1] ?? '0', 10);
      if (count > 0) rows.push({ from: fromId, to: toId, count });
    });
  }
  return rows; // [{from, to, count}]
}

function resolutionLabel(filename) {
  // 'sankey_leiden_0.3_to_leiden_0.5.csv' → ['0.3','0.5']
  const m = filename.match(/leiden_(\d+(?:\.\d+)?)_to_leiden_(\d+(?:\.\d+)?)/);
  if (m) return [m[1], m[2]];
  return [filename, '?'];
}

const CELL_TYPE_COLORS = {
  Endodermis:      '#68d391',
  Cortex:          '#f6ad55',
  Trichoblast:     '#90cdf4',
  Atrichoblast:    '#76e4f7',
  LRC:             '#fc8181',
  Columella:       '#b794f4',
  QC:              '#fbb6ce',
  Phloem:          '#f6e05e',
  Xylem:           '#4fd1c5',
  'Stele tissue':  '#9f7aea',
  Procambium:      '#ed8936',
  XPP:             '#63b3ed',
  PPP:             '#48bb78',
  Pericycle:       '#ecc94b',
  Meristematic:    '#fc8181',
  'Ground tissue': '#a0aec0',
  Unassigned:      '#4a5568',
};

function clusterColor(annotation) {
  if (!annotation) return '#2d3748';
  for (const [key, color] of Object.entries(CELL_TYPE_COLORS)) {
    if (annotation.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#718096';
}

// ── Layout engine ─────────────────────────────────────────────────────
function buildLayout(transitions, annotationsByRes, width, height) {
  // transitions: [{resKey, links: [{from, to, count}]}]
  // returns {cols, links} for SVG rendering

  const PAD = 40;
  const colW = 120;
  const nodeH = 22;
  const nodeGap = 6;

  // Collect resolutions in order
  const resolutions = [];
  for (const { resKey, fromRes, toRes } of transitions) {
    if (!resolutions.includes(fromRes)) resolutions.push(fromRes);
    if (!resolutions.includes(toRes))   resolutions.push(toRes);
  }

  // For each resolution, collect clusters ordered by their cluster id (numeric)
  const clustersByRes = {};
  for (const t of transitions) {
    if (!clustersByRes[t.fromRes]) clustersByRes[t.fromRes] = new Set();
    if (!clustersByRes[t.toRes])   clustersByRes[t.toRes]   = new Set();
    for (const l of t.links) {
      clustersByRes[t.fromRes].add(l.from);
      clustersByRes[t.toRes].add(l.to);
    }
  }

  // Total cells per cluster per resolution (sum of link counts leaving or entering)
  const cellsPerCluster = {}; // `${res}__${cluster}` → total cells
  for (const t of transitions) {
    for (const l of t.links) {
      const fk = `${t.fromRes}__${l.from}`;
      const tk = `${t.toRes}__${l.to}`;
      cellsPerCluster[fk] = (cellsPerCluster[fk] ?? 0) + l.count;
      cellsPerCluster[tk] = (cellsPerCluster[tk] ?? 0) + l.count;
    }
  }

  // Build columns
  const cols = resolutions.map((res, ci) => {
    const clusters = [...(clustersByRes[res] ?? new Set())]
      .sort((a, b) => parseInt(a) - parseInt(b));
    const totalCells = clusters.reduce((s, c) => s + (cellsPerCluster[`${res}__${c}`] ?? 0), 0);
    const usableH = height - PAD * 2;
    let y = PAD;
    const nodes = clusters.map(id => {
      const cells = cellsPerCluster[`${res}__${id}`] ?? 0;
      const h = Math.max(nodeH, (cells / totalCells) * usableH - nodeGap);
      const node = { id, res, cells, y, h, annotation: (annotationsByRes[res] ?? {})[id] };
      y += h + nodeGap;
      return node;
    });
    const x = PAD + ci * ((width - PAD * 2) / Math.max(resolutions.length - 1, 1));
    return { res, nodes, x };
  });

  // Build links between adjacent cols
  const links = [];
  for (const t of transitions) {
    const fromCol = cols.find(c => c.res === t.fromRes);
    const toCol   = cols.find(c => c.res === t.toRes);
    if (!fromCol || !toCol) continue;

    // Track used y within each node (for stacking links)
    const fromUsed = {};
    const toUsed   = {};

    // Sort links for stable stacking: by from then to
    const sorted = [...t.links].sort((a, b) =>
      parseInt(a.from) - parseInt(b.from) || parseInt(a.to) - parseInt(b.to));

    for (const l of sorted) {
      const fromNode = fromCol.nodes.find(n => n.id === l.from);
      const toNode   = toCol.nodes.find(n => n.id === l.to);
      if (!fromNode || !toNode) continue;

      const totalFrom = cellsPerCluster[`${t.fromRes}__${l.from}`] ?? 1;
      const totalTo   = cellsPerCluster[`${t.toRes}__${l.to}`]     ?? 1;

      const fromH = (l.count / totalFrom) * fromNode.h;
      const toH   = (l.count / totalTo)   * toNode.h;

      const fy = fromNode.y + (fromUsed[l.from] ?? 0);
      const ty = toNode.y   + (toUsed[l.to]     ?? 0);

      fromUsed[l.from] = (fromUsed[l.from] ?? 0) + fromH;
      toUsed[l.to]     = (toUsed[l.to]     ?? 0) + toH;

      links.push({
        x1: fromCol.x + 20,
        y1: fy,
        h1: fromH,
        x2: toCol.x,
        y2: ty,
        h2: toH,
        count: l.count,
        fromId: l.from,
        toId: l.to,
        fromRes: t.fromRes,
        toRes: t.toRes,
        color: clusterColor(fromNode.annotation),
      });
    }
  }

  return { cols, links };
}

// ── Label transfer (exported for tests) ──────────────────────────────
// Returns { "res__id": annotation } for all clusters reachable from sourceRes
// using proportional BFS through transitions.
export function computeLabelTransfer(transitions, sourceRes, sourceAnnotations) {
  // Build adjacency: (fromRes, fromId) → [{toRes, toId, count}]
  // and also total outgoing count per (fromRes, fromId)
  const fwd = {}; // key → [{toRes, toId, count}]
  for (const t of transitions) {
    for (const l of t.links) {
      const k = `${t.fromRes}__${l.from}`;
      (fwd[k] = fwd[k] ?? []).push({ toRes: t.toRes, toId: l.to, count: l.count });
    }
  }

  const result = {};

  // For every cluster in every non-source resolution, propagate forward to sourceRes
  // using weight = proportion of cells flowing through each edge.
  const allResolutions = [...new Set(
    transitions.flatMap(t => [t.fromRes, t.toRes])
  )];

  for (const res of allResolutions) {
    if (res === sourceRes) continue;

    // Collect clusters in this resolution
    const clusters = new Set();
    for (const t of transitions) {
      if (t.fromRes === res) t.links.forEach(l => clusters.add(l.from));
      if (t.toRes   === res) t.links.forEach(l => clusters.add(l.to));
    }

    for (const id of clusters) {
      // BFS: frontier = Map<"res__id" → weight>
      let frontier = new Map([[`${res}__${id}`, 1.0]]);
      const votes = {}; // annotation → accumulated weight

      const maxSteps = allResolutions.length + 1;
      for (let step = 0; step < maxSteps && frontier.size > 0; step++) {
        const next = new Map();
        for (const [node, w] of frontier) {
          const [nRes, nId] = node.split('__');
          if (nRes === sourceRes) {
            const ann = sourceAnnotations[nId];
            if (ann) votes[ann] = (votes[ann] ?? 0) + w;
            continue;
          }
          const edges = fwd[node];
          if (!edges?.length) continue;
          const total = edges.reduce((s, e) => s + e.count, 0);
          for (const e of edges) {
            const nk = `${e.toRes}__${e.toId}`;
            next.set(nk, (next.get(nk) ?? 0) + w * (e.count / total));
          }
        }
        frontier = next;
      }

      const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      if (best) result[`${res}__${id}`] = best[0];
    }
  }

  return result;
}

// ── BFS highlight (exported for tests) ───────────────────────────────
export function computeHighlightedLinks(selectedNode, links) {
  if (!selectedNode || links.length === 0) return null;
  const reachable = new Set();
  const origin = `${selectedNode.res}__${selectedNode.id}`;

  const fq = [origin]; const fv = new Set();
  while (fq.length) {
    const curr = fq.shift();
    if (fv.has(curr)) continue;
    fv.add(curr);
    links.forEach((l, i) => {
      if (`${l.fromRes}__${l.fromId}` === curr) {
        reachable.add(i);
        fq.push(`${l.toRes}__${l.toId}`);
      }
    });
  }

  const bq = [origin]; const bv = new Set();
  while (bq.length) {
    const curr = bq.shift();
    if (bv.has(curr)) continue;
    bv.add(curr);
    links.forEach((l, i) => {
      if (`${l.toRes}__${l.toId}` === curr) {
        reachable.add(i);
        bq.push(`${l.fromRes}__${l.fromId}`);
      }
    });
  }

  return reachable;
}

// ── Main component ────────────────────────────────────────────────────
export function SankeyTab({ onGoToAnnotator }) {
  const { annotations, setBulk } = useAnnotations();
  const [transitions, setTransitions] = useState([]); // [{resKey, fromRes, toRes, links}]
  const [scoringFiles, setScoringFiles] = useState({}); // res → [{Cluster, n_cells, ...}]
  const [hoveredLink, setHoveredLink] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 900, height: 540 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => {
      setDims({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  function handleTransitionFile(e) {
    const files = [...e.target.files];
    e.target.value = '';
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const [fromRes, toRes] = resolutionLabel(file.name);
        const links = parseTransitionCsv(ev.target.result);
        if (!links) return;
        setTransitions(prev => {
          const key = `${fromRes}_${toRes}`;
          const filtered = prev.filter(t => t.resKey !== key);
          return [...filtered, { resKey: key, fromRes, toRes, links }]
            .sort((a, b) => parseFloat(a.fromRes) - parseFloat(b.fromRes));
        });
      };
      reader.readAsText(file);
    });
  }

  function handleScoringFile(e) {
    const files = [...e.target.files];
    e.target.value = '';
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const rows = parseScoringCsv(ev.target.result);
        // Infer resolution from filename: cluster_scoring_leiden_1.0.csv
        const m = file.name.match(/leiden_(\d+(?:\.\d+)?)/);
        if (!m) return;
        const res = m[1];
        setScoringFiles(prev => ({ ...prev, [res]: rows }));
      };
      reader.readAsText(file);
    });
  }

  // Build annotations per resolution: res → {clusterId → cellType}
  // annotations from useAnnotations are keyed by cluster id (no resolution prefix)
  // Scoring files tell us cluster ids per resolution
  const annotationsByRes = useMemo(() => {
    const result = {};
    // From scoring files (Top_1_type fallback)
    for (const [res, rows] of Object.entries(scoringFiles)) {
      result[res] = {};
      for (const row of rows) {
        const id = String(row['Cluster'] ?? row[Object.keys(row)[0]]);
        result[res][id] = annotations[`${res}__${id}`] ?? annotations[id] ?? row.Top_1_type ?? null;
      }
    }
    // Pick up res__id keys from label transfer even without a scoring file
    for (const [key, ann] of Object.entries(annotations)) {
      if (!key.includes('__')) continue;
      const sep = key.indexOf('__');
      const res = key.slice(0, sep);
      const id  = key.slice(sep + 2);
      if (!result[res]) result[res] = {};
      if (!result[res][id]) result[res][id] = ann;
    }
    return result;
  }, [scoringFiles, annotations]);

  const { cols, links } = useMemo(() => {
    if (transitions.length === 0) return { cols: [], links: [] };
    return buildLayout(transitions, annotationsByRes, dims.width, dims.height);
  }, [transitions, annotationsByRes, dims]);

  const highlightedLinks = useMemo(
    () => computeHighlightedLinks(selectedNode, links),
    [selectedNode, links],
  );

  const highlightedNodes = useMemo(() => {
    if (!selectedNode || !highlightedLinks) return null;
    const nodes = new Set([`${selectedNode.res}__${selectedNode.id}`]);
    highlightedLinks.forEach(i => {
      nodes.add(`${links[i].fromRes}__${links[i].fromId}`);
      nodes.add(`${links[i].toRes}__${links[i].toId}`);
    });
    return nodes;
  }, [selectedNode, highlightedLinks, links]);

  function handleNodeClick(node) {
    setSelectedNode(prev =>
      prev?.id === node.id && prev?.res === node.res ? null : node
    );
  }

  // Source resolution = highest numeric resolution that has annotations loaded
  const sourceRes = useMemo(() => {
    const resWithAnnotations = Object.keys(annotationsByRes)
      .filter(r => Object.values(annotationsByRes[r]).some(v => v));
    if (!resWithAnnotations.length) return null;
    return resWithAnnotations.sort((a, b) => parseFloat(b) - parseFloat(a))[0];
  }, [annotationsByRes]);

  function handleLabelTransfer() {
    if (!sourceRes) return;
    const sourceAnnotations = annotationsByRes[sourceRes] ?? {};
    const transferred = computeLabelTransfer(transitions, sourceRes, sourceAnnotations);
    setBulk(transferred);
  }

  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);

  function handleExportAll() {
    const resolutions = [...new Set(
      transitions.flatMap(t => [t.fromRes, t.toRes])
    )].sort((a, b) => parseFloat(a) - parseFloat(b));

    const blocks = resolutions.map(res => {
      const ann = annotationsByRes[res] ?? {};
      const varName = `cell_type_leiden_${res.replace('.', '_')}`;
      const entries = Object.entries(ann)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([id, type]) =>
          type ? `    '${id}': '${type}',` : `    # '${id}': '',  # TODO`
        ).join('\n');
      return `${varName} = {\n${entries}\n}`;
    });

    const text = blocks.join('\n\n');
    setExportText(text);
    setShowExport(true);
    setCopied(false);
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const loaded = transitions.length;

  return (
    <>
      <aside className="sidebar">
        <div className="annotator-upload">
          <label className="upload-file-label">
            Transition CSVs
            <span className="upload-optional"> (sankey_leiden_X_to_leiden_Y.csv)</span>
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleTransitionFile}
            />
          </label>
          <label className="upload-file-label secondary">
            Scoring CSVs (opcional, para anotaciones)
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleScoringFile}
            />
          </label>
        </div>

        {loaded > 0 && (
          <div className="sankey-loaded">
            <span className="de-loaded-badge">
              {loaded} transición{loaded > 1 ? 'es' : ''} cargada{loaded > 1 ? 's' : ''}
            </span>
            {cols.length > 0 && (
              <div className="sankey-resolutions">
                {cols.map(c => (
                  <div key={c.res} className="sankey-res-summary">
                    <span className="sankey-res-label">leiden_{c.res}</span>
                    <span className="sankey-res-count">{c.nodes.length} clusters</span>
                  </div>
                ))}
              </div>
            )}
            {sourceRes && (
              <button className="sankey-transfer-btn" onClick={handleLabelTransfer}>
                Transferir etiquetas desde leiden_{sourceRes}
              </button>
            )}
            {Object.keys(annotationsByRes).length > 0 && (
              <button className="sankey-transfer-btn sankey-export-btn" onClick={handleExportAll}>
                Exportar Python dicts →
              </button>
            )}
          </div>
        )}

        {hoveredNode && (
          <div className="sankey-tooltip-panel">
            <div className="sankey-tip-title">
              Cluster {hoveredNode.id} — leiden_{hoveredNode.res}
            </div>
            {hoveredNode.annotation && (
              <div className="sankey-tip-ann">{hoveredNode.annotation}</div>
            )}
            <div className="sankey-tip-cells">{hoveredNode.cells.toLocaleString()} células</div>
            {onGoToAnnotator && (
              <button
                className="sankey-goto-btn"
                onClick={() => onGoToAnnotator(hoveredNode.res, hoveredNode.id)}
              >
                Ver en Annotator →
              </button>
            )}
          </div>
        )}

        {hoveredLink && (
          <div className="sankey-tooltip-panel">
            <div className="sankey-tip-title">
              {hoveredLink.fromRes} cl.{hoveredLink.fromId} → {hoveredLink.toRes} cl.{hoveredLink.toId}
            </div>
            <div className="sankey-tip-cells">
              {hoveredLink.count.toLocaleString()} células en común
            </div>
          </div>
        )}

        <div className="sankey-legend">
          <div className="detail-section-title" style={{ marginBottom: 6 }}>Colores</div>
          {Object.entries(CELL_TYPE_COLORS).slice(0, 10).map(([ct, color]) => (
            <div key={ct} className="sankey-legend-item">
              <span className="sankey-legend-dot" style={{ background: color }} />
              <span className="sankey-legend-label">{ct}</span>
            </div>
          ))}
          <div className="sankey-legend-item">
            <span className="sankey-legend-dot" style={{ background: '#2d3748' }} />
            <span className="sankey-legend-label">Sin anotar</span>
          </div>
        </div>
      </aside>

      <section className="matrix-area" ref={containerRef} style={{ overflow: 'hidden' }}>
        {transitions.length === 0 && (
          <div className="empty-state">
            Corré la celda de exportación en el notebook,<br />
            luego subí los archivos <code>sankey_leiden_X_to_leiden_Y.csv</code>
          </div>
        )}

        {transitions.length > 0 && (
          <svg
            width={dims.width}
            height={dims.height}
            style={{ display: 'block' }}
            onClick={e => { if (e.target.tagName === 'svg') setSelectedNode(null); }}
          >
            {/* Links */}
            {links.map((l, i) => {
              const isHovered = hoveredLink === l;
              const isHighlighted = !highlightedLinks || highlightedLinks.has(i);
              const cx1 = l.x1 + (l.x2 - l.x1) * 0.4;
              const cx2 = l.x1 + (l.x2 - l.x1) * 0.6;
              const top = `M${l.x1},${l.y1} C${cx1},${l.y1} ${cx2},${l.y2} ${l.x2},${l.y2}`;
              const bot = `L${l.x2},${l.y2 + l.h2} C${cx2},${l.y2 + l.h2} ${cx1},${l.y1 + l.h1} ${l.x1},${l.y1 + l.h1} Z`;

              return (
                <path
                  key={i}
                  d={top + bot}
                  fill={l.color}
                  fillOpacity={isHighlighted ? (isHovered ? 0.65 : 0.45) : 0.04}
                  stroke={l.color}
                  strokeOpacity={isHighlighted ? (isHovered ? 1 : 0.6) : 0.08}
                  strokeWidth={0.5}
                  style={{ cursor: 'pointer', transition: 'fill-opacity 0.2s, stroke-opacity 0.2s' }}
                  onMouseEnter={() => { setHoveredLink(l); setHoveredNode(null); }}
                  onMouseLeave={() => setHoveredLink(null)}
                />
              );
            })}

            {/* Nodes */}
            {cols.map(col =>
              col.nodes.map(node => {
                const color = clusterColor(node.annotation);
                const nodeKey = `${node.res}__${node.id}`;
                const isHovered  = hoveredNode?.id === node.id && hoveredNode?.res === node.res;
                const isSelected = selectedNode?.id === node.id && selectedNode?.res === node.res;
                const isInPath   = !highlightedNodes || highlightedNodes.has(nodeKey);
                return (
                  <g
                    key={`${col.res}-${node.id}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => { setHoveredNode(node); setHoveredLink(null); }}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={e => { e.stopPropagation(); handleNodeClick(node); }}
                  >
                    <rect
                      x={col.x}
                      y={node.y}
                      width={20}
                      height={Math.max(node.h, 2)}
                      fill={color}
                      opacity={isInPath ? (isHovered || isSelected ? 1 : 0.85) : 0.15}
                      rx={3}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />
                    {node.h >= 16 && (
                      <text
                        x={col.x + 24}
                        y={node.y + node.h / 2 + 4}
                        fontSize={10}
                        fill={isInPath ? '#a0aec0' : '#2d3748'}
                        style={{ transition: 'fill 0.2s' }}
                      >
                        {node.id}
                        {node.annotation ? ` · ${node.annotation.slice(0, 12)}` : ''}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* Resolution labels */}
            {cols.map(col => (
              <text
                key={col.res}
                x={col.x + 10}
                y={20}
                fontSize={11}
                fontWeight={700}
                fill="#718096"
                textAnchor="middle"
              >
                leiden_{col.res}
              </text>
            ))}
          </svg>
        )}
      </section>

      {showExport && (
        <div className="export-overlay">
          <div className="export-overlay-header">
            <strong>Python dicts — todas las resoluciones</strong>
            <div className="export-overlay-actions">
              <button
                className="copy-export-btn"
                onClick={() => {
                  navigator.clipboard.writeText(exportText).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button className="close-btn" onClick={() => setShowExport(false)}>×</button>
            </div>
          </div>
          <pre className="export-pre">{exportText}</pre>
        </div>
      )}
    </>
  );
}
