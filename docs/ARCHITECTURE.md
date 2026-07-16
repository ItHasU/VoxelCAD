# Architecture

Ce document décrit l'organisation prévue du code et le flux de données de bout en bout. Les choix résumés ici sont justifiés dans [DECISIONS.md](DECISIONS.md).

## Flux de données

```
┌─────────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│  Éditeur Monaco  │────▶│ Transpilation TS→JS  │────▶│  Web Worker "sampler"  │
│  isInside(x,y,z) │     │ (language service    │     │  itère sur la grille   │
│                  │     │  interne de Monaco)  │     │  et appelle isInside   │
└─────────────────┘     └──────────────────────┘     └───────────┬────────────┘
                                                                   │ voxels pleins
                                                                   ▼
┌──────────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│  Export STL/GLB   │◀────│  Géométrie fusionnée │◀────│   Voxel meshing        │
│ (STLExporter/     │     │  (BufferGeometry)     │     │  (culling des faces   │
│  GLTFExporter)     │     │                      │     │   internes)            │
└──────────────────┘     └───────────┬──────────┘     └───────────────────────┘
                                      ▼
                          ┌──────────────────────┐
                          │   Viewer three.js     │
                          │ (scene, caméra,        │
                          │  OrbitControls)        │
                          └──────────────────────┘
```

1. **Éditeur** : l'utilisateur écrit/modifie `isInside`, choisit éventuellement un exemple prédéfini (cube, sphère, cylindre) qui préremplit l'éditeur.
2. **Formulaire de paramètres** : bornes `xMin/xMax`, `yMin/yMax`, `zMin/zMax`, et `step` (pas de calcul).
3. **Génération** (déclenchée par un bouton) :
   - Validation des paramètres (bornes cohérentes, pas > 0).
   - Estimation du nombre de voxels total ; avertissement/blocage si trop élevé (garde-fou perf, cf. décision 4).
   - Transpilation du code de l'éditeur en JS.
   - Envoi du code JS + paramètres de grille au Web Worker.
4. **Web Worker** : itère sur chaque cellule de la grille, appelle `isInside(x, y, z)`, accumule les cellules pleines dans une structure compacte (ex. `Uint8Array` indexée par `(i, j, k)`), envoie une progression périodique, puis renvoie le résultat complet.
5. **Voxel meshing** (thread principal ou worker) : à partir de la grille de booléens, génère une géométrie fusionnée en n'émettant que les faces exposées (voisin vide ou hors grille).
6. **Viewer** : affiche la géométrie dans une scène three.js (lumière, `OrbitControls` pour tourner/zoomer/déplacer, grid helper pour repère visuel).
7. **Export** : la même géométrie fusionnée est passée à `STLExporter` ou `GLTFExporter`, le résultat est proposé au téléchargement (`Blob` + lien `download`).

## Arborescence prévue

```
src/
  main.ts                  # point d'entrée, câble les modules ensemble
  editor/
    monacoSetup.ts         # configuration Monaco (langage, compilerOptions, thème)
    transpile.ts           # récupère le JS émis via le language service Monaco
    examples/
      cube.ts              # code source (string) de l'exemple cube
      sphere.ts             # code source (string) de l'exemple sphère
      cylinder.ts           # code source (string) de l'exemple cylindre
  voxel/
    grid.ts                # itération sur la grille à partir des bornes + step
    sampler.worker.ts      # Web Worker : exécute isInside sur la grille
    meshing.ts             # génération de géométrie avec culling des faces internes
  viewer/
    scene.ts               # setup three.js (scène, caméra, lumières, controls)
    resize.ts               # gestion du redimensionnement du canvas
  export/
    exportStl.ts            # wrapper STLExporter + déclenchement du téléchargement
    exportGlb.ts             # wrapper GLTFExporter + déclenchement du téléchargement
  ui/
    boundsForm.ts            # formulaire bornes X/Y/Z + step
    exampleSelector.ts        # sélecteur d'exemples prédéfinis
    progress.ts               # barre/indicateur de progression pendant le calcul
    errorPanel.ts             # affichage des erreurs de compilation/exécution utilisateur
  style.css
index.html
vite.config.ts
docs/
  ARCHITECTURE.md
  DECISIONS.md
  TASKS.md
```

## Algorithme de voxel meshing (V1)

Entrée : une grille 3D de booléens `filled[i][j][k]` (dimensions `nx × ny × nz`, déduites des bornes et du pas).

Pour chaque cellule pleine `(i, j, k)` :
- Pour chacune des 6 directions (±X, ±Y, ±Z), vérifier la cellule voisine.
- Si la cellule voisine est vide ou hors grille, émettre la face correspondante (2 triangles) à la position du voxel.
- Sinon, ne rien émettre (face interne, invisible).

Les faces émises sont accumulées dans des tableaux de positions/normales/indices, puis fusionnées en une seule `BufferGeometry` via `BufferGeometryUtils.mergeGeometries`, réutilisée à la fois par le viewer et par les exporteurs.

*Évolution possible (hors V1)* : greedy meshing, qui fusionne les faces coplanaires adjacentes en rectangles pour réduire encore le nombre de triangles sur de grandes surfaces planes. Non nécessaire tant que les grilles restent d'une taille raisonnable.

## Gestion de la performance / grosses grilles

- Le nombre total de voxels (`nx × ny × nz`) est calculé côté UI avant lancement, avec un seuil configurable au-delà duquel un avertissement (ou blocage) est affiché.
- Le calcul de `isInside` sur toute la grille se fait dans un Web Worker pour ne pas geler l'UI ; des messages de progression périodiques permettent d'afficher une barre de progression.
- Le meshing (culling des faces) est en `O(nx × ny × nz)` avec un facteur constant faible (6 vérifications de voisin par voxel plein) — suffisant en V1.

## Sécurité / modèle de menace

Le code de `isInside` est écrit et exécuté par le même utilisateur, localement dans son navigateur, dans un Web Worker de la même origine. Ce n'est **pas** un sandbox contre du code hostile tiers (pas d'isolation type iframe sandboxée ou de VM JS séparée) — voir décision 4. Si un usage multi-utilisateurs ou de partage de code est envisagé plus tard, ce point devra être réévalué (ex. iframe `sandbox` sans `allow-same-origin`, ou exécution côté serveur isolée).

## Build

- **Dev** : `vite` (serveur de dev avec HMR/watch natif sur les fichiers TS/CSS/HTML).
- **Prod** : `vite build` + `vite-plugin-singlefile`, produisant `dist/index.html` unique (HTML + CSS + JS inlinés). Les workers (sampler, workers internes de Monaco) doivent être compatibles avec cette approche single-file (chargement via Blob URL plutôt que fichier séparé si nécessaire).
