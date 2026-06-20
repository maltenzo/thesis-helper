# Thesis Helper — Resumen de funcionalidades

App web (React) para explorar y anotar tipos celulares de raíz de *Arabidopsis thaliana*. Es la herramienta
de apoyo a la anotación del atlas scRNA-seq: conecta marcadores de la base pública **PlantscRNAdb** con los
resultados de clustering de la tesis. Tiene **3 pestañas**.

---

## 1. Explorer — marcadores por tipo celular

Pega una lista de genes (AGI codes), trae sus marcadores y muestra qué tipos celulares marcan.

- **Búsqueda por lista de genes** contra la API de PlantscRNAdb.
- **Filtrado automático** a *Arabidopsis thaliana* + tejido raíz.
- **Matriz gen × tipo celular**: muestra en qué tipos celulares hay evidencia de cada gen.
- **Panel de detalle**: al clickear un gen o un tipo celular, ves todos los registros de marcadores asociados.
- **Filtros opcionales**: solo marcadores de alta confianza, solo single-cell, genes únicos.
- **Clusters guardados**: guardás conjuntos de genes + filtros + resultados con nombre (persisten en el navegador);
  se pueden cargar, borrar, y **exportar/importar** (texto base64) para compartir.

---

## 2. Annotator (BETA) — anotar clusters asistido

Flujo para asignar un tipo celular a cada cluster de Leiden, partiendo de los CSV que produce la tesis.

- **Carga el CSV de scoring** (`cluster_scoring_leiden_X.csv` o `preliminary_vs_manual_...`). Detecta la
  resolución (ej. `leiden_1.0`) del nombre del archivo.
- **Carga opcional del CSV de DE** (genes diferenciales) para ver los top genes de cada cluster mientras anotás.
- **Lista de clusters con progreso** (X/Y anotados) y detalle por cluster: scores, nº de células, top DE genes.
- **Asignación con autoavance**: al asignar un tipo, salta automáticamente al siguiente cluster sin anotar.
- **"Send to Explorer"**: manda los genes DE de un cluster a la pestaña Explorer para validar contra PlantscRNAdb.
- **Autopilot (sugerencia automática)**: por *bootstrap* sobre los genes DE del cluster, propone los 3 tipos
  celulares más probables con un nivel de confianza. Es una sugerencia, no decide por vos.
- **Export a dict de Python**: genera el diccionario `combined_insights = {cluster: 'tipo', ...}` listo para
  pegar en el notebook de anotación (y lo copia al portapapeles). Los clusters sin anotar quedan como `# TODO`.
- Anotaciones persisten en el navegador, separadas por resolución.

---

## 3. Sankey (BETA) — flujo de clusters entre resoluciones

Visualiza cómo se subdividen los clusters al cambiar la resolución de Leiden.

- **Carga el CSV de transición** (`sankey_leiden_0.3_to_leiden_0.5.csv`, etc.: matriz de conteos cluster→cluster).
- **Diagrama Sankey** que muestra qué clusters de una resolución se separan/funden en la siguiente.
- **Coloreado por tipo celular anotado** (reusa las anotaciones del Annotator), así se ve cómo se reparte cada
  tipo al subir la resolución.

---

## En una línea

**Explorer** = ¿qué tipos marca este gen? · **Annotator** = asigná tipo a cada cluster (con sugerencia automática
y export al notebook) · **Sankey** = cómo se dividen los clusters entre resoluciones.

> Nota: el `README.md` está desactualizado (solo describe el Explorer); las pestañas Annotator y Sankey no figuran ahí.
