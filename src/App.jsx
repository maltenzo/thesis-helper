import { useState, useRef } from 'react';
import { GeneInput } from './GeneInput';
import { MatrixTable } from './MatrixTable';
import { DetailPanel } from './DetailPanel';
import { SaveCluster, SavedClusterList } from './SavedClusters';
import { AnnotatorTab } from './AnnotatorTab';
import { SankeyTab } from './SankeyTab';
import { useGeneData, serializeResults } from './useGeneData';
import { useSavedClusters } from './useSavedClusters';
import './App.css';

export default function App() {
  const { status, progress, geneMap, cellTypeMap, error, search, loadResults, clear } = useGeneData();
  const { clusters, save, remove, toBase64, fromBase64 } = useSavedClusters();
  const [selectedGene, setSelectedGene] = useState(null);
  const [selectedCellType, setSelectedCellType] = useState(null);
  const [currentGenes, setCurrentGenes] = useState([]);
  const [currentFilters, setCurrentFilters] = useState({});
  const [activeTab, setActiveTab] = useState('explorer');
  const geneInputRef = useRef(null);

  function handleSearch(genes, filters) {
    setSelectedGene(null);
    setSelectedCellType(null);
    setCurrentGenes(genes);
    setCurrentFilters(filters);
    search(genes, filters);
  }

  function handleSave(name, genes, filters, notes) {
    const results = geneMap.size > 0 ? serializeResults(geneMap, cellTypeMap) : null;
    save(name, genes, filters, notes, results);
  }

  function handleLoadCluster(cluster) {
    setCurrentGenes(cluster.genes);
    setCurrentFilters(cluster.filters);
    setSelectedGene(null);
    setSelectedCellType(null);
    geneInputRef.current?.load(cluster.genes, cluster.filters);
    if (cluster.results) {
      loadResults(cluster.results);
    } else {
      search(cluster.genes, cluster.filters);
    }
  }

  function handleClear() {
    clear();
    geneInputRef.current?.reset();
    setSelectedGene(null);
    setSelectedCellType(null);
    setCurrentGenes([]);
    setCurrentFilters({});
  }

  function sendToExplorer(genes) {
    setActiveTab('explorer');
    setCurrentGenes(genes);
    setCurrentFilters({});
    setSelectedGene(null);
    setSelectedCellType(null);
    geneInputRef.current?.load(genes, {});
    search(genes, {});
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Arabidopsis Root scRNA Explorer</h1>
        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            Explorer
          </button>
          <button
            className={`tab-btn ${activeTab === 'annotator' ? 'active' : ''}`}
            onClick={() => setActiveTab('annotator')}
          >
            Annotator <span className="tab-beta">BETA</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'sankey' ? 'active' : ''}`}
            onClick={() => setActiveTab('sankey')}
          >
            Sankey <span className="tab-beta">BETA</span>
          </button>
        </nav>
        <button
          className="clear-btn"
          style={{ visibility: activeTab === 'explorer' ? 'visible' : 'hidden' }}
          onClick={handleClear}
          disabled={status === 'idle'}
        >
          Clear
        </button>
      </header>

      {/* Explorer tab — always mounted to preserve GeneInput ref */}
      <main className={`app-main ${activeTab !== 'explorer' ? 'tab-hidden' : ''}`}>
        <aside className="sidebar">
          <GeneInput
            ref={geneInputRef}
            onSearch={handleSearch}
            onInputChange={(genes, filters) => {
              setCurrentGenes(genes);
              setCurrentFilters(filters);
            }}
            loading={status === 'loading'}
          />

          <SaveCluster
            genes={currentGenes}
            filters={currentFilters}
            onSave={handleSave}
          />

          {status === 'loading' && (
            <div className="progress-wrap">
              <div className="progress-bar-outer">
                <div
                  className="progress-bar-inner"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <span className="progress-label">{progress.done} / {progress.total} genes</span>
            </div>
          )}

          {error && <div className="error-msg">Error: {error}</div>}

          {status === 'done' && geneMap.size === 0 && (
            <div className="no-results">No root markers found for these genes.</div>
          )}

          {status === 'done' && geneMap.size > 0 && (
            <DetailPanel
              selectedGene={selectedGene}
              selectedCellType={selectedCellType}
              geneMap={geneMap}
              cellTypeMap={cellTypeMap}
              onClose={() => { setSelectedGene(null); setSelectedCellType(null); }}
            />
          )}

          <SavedClusterList
            clusters={clusters}
            onLoad={handleLoadCluster}
            onDelete={remove}
            onExport={toBase64}
            onImport={fromBase64}
          />
        </aside>

        <section className="matrix-area">
          {status === 'done' && geneMap.size > 0 && (
            <MatrixTable
              geneMap={geneMap}
              cellTypeMap={cellTypeMap}
              onSelectGene={(gene) => { setSelectedGene(gene); setSelectedCellType(null); }}
              onSelectCellType={(ct) => { setSelectedCellType(ct); setSelectedGene(null); }}
            />
          )}

          {status === 'idle' && (
            <div className="empty-state">
              Paste genes on the left, hit Search.
              <br />
              Filters to <em>Arabidopsis thaliana</em> root tissue automatically.
            </div>
          )}
        </section>
      </main>

      {/* Annotator tab — always mounted to preserve uploaded CSV state */}
      <main className={`app-main ${activeTab !== 'annotator' ? 'tab-hidden' : ''}`}>
        <AnnotatorTab onSendToExplorer={sendToExplorer} />
      </main>

      {/* Sankey tab — always mounted to preserve uploaded CSV state */}
      <main className={`app-main ${activeTab !== 'sankey' ? 'tab-hidden' : ''}`}>
        <SankeyTab onGoToAnnotator={() => setActiveTab('annotator')} />
      </main>
    </div>
  );
}
