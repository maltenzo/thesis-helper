# Thesis Helper — Arabidopsis Root scRNA Explorer

React app for exploring single-cell RNA marker data from [PlantscRNAdb](http://ibi.zju.edu.cn/plantscrnadb/).

## What it does

- Input a list of gene IDs, fetches all marker records from PlantscRNAdb API
- Filters automatically to *Arabidopsis thaliana* root tissue
- Displays a **gene × cell type matrix** showing expression presence per cell type
- Click any gene or cell type to see a detail panel with full marker records
- Optional filters: high-confidence markers, single-cell only, unique genes
- Save/load named clusters (gene sets + filters + results) via localStorage

## Run

```bash
npm install
npm run dev
```
