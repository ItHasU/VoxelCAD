# Liste des tâches

Backlog organisé par phases. Chaque phase produit un incrément utilisable/testable. Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour le détail des modules et [DECISIONS.md](DECISIONS.md) pour les choix techniques sous-jacents.

## Phase 0 — Setup projet

- [x] Scaffold projet Vite + TypeScript (`npm create vite@latest` template `vanilla-ts`).
- [x] Ajouter `vite-plugin-singlefile` et configurer `vite.config.ts` pour le build de production.
- [x] Configurer `tsconfig.json` (strict mode).
- [x] Ajouter linting/formatage (ESLint + Prettier ou Biome).
- [x] Mettre en place la structure de dossiers `src/` décrite dans ARCHITECTURE.md.
- [x] Vérifier qu'un `npm run dev` fonctionne avec watch/refresh, et qu'un `npm run build` produit bien un `dist/index.html` unique (test sur une page "Hello World" avant d'ajouter la logique métier).
- [x] Mettre à jour la section "Démarrage" du README avec les commandes réelles.

## Phase 1 — Cœur du moteur voxel

- [x] `grid.ts` : fonction d'itération sur la grille à partir de `xMin/xMax/yMin/yMax/zMin/zMax/step` (calcul de `nx, ny, nz`, conversion index ↔ coordonnées).
- [x] Garde-fou : calcul du nombre total de voxels, seuil d'avertissement/blocage configurable.
- [x] `sampler.worker.ts` : Web Worker qui reçoit le code JS transpilé + les paramètres de grille, exécute `isInside` sur chaque cellule, renvoie une structure compacte (ex. `Uint8Array`) + progression périodique.
- [x] Vérifier le fonctionnement du worker une fois inliné par `vite-plugin-singlefile` (via l'import `?worker&inline` de Vite, testé en ouverture `file://` avec Playwright).
- [x] `meshing.ts` : génération de géométrie avec culling des faces internes (algorithme décrit dans ARCHITECTURE.md).
- [x] Tests unitaires (Vitest) : itération de grille, cas limites (grille vide, grille pleine, un seul voxel), meshing (nombre de faces attendu sur des cas simples comme un cube 1×1×1, 2×2×2).

## Phase 2 — Éditeur Monaco

- [x] Intégrer Monaco Editor (`monaco-editor`, workers inline via `?worker&inline` pour le single-file).
- [x] Configurer le langage TypeScript, les `compilerOptions`, et un type de référence `IsInside` (extraLib).
- [x] `transpile.ts` : récupérer le JS émis via le language service interne de Monaco (`getEmitOutput`), en transpilant le modèle de l'éditeur (évite la collision « Duplicate function implementation »).
- [x] Afficher les diagnostics de compilation TypeScript directement dans l'éditeur (diagnostics Monaco natifs).
- [x] `errorPanel.ts` : afficher les erreurs d'exécution levées par `isInside` pendant l'échantillonnage (avec le point fautif).
- [x] Exemples prédéfinis : `cube.ts`, `sphere.ts`, `cylinder.ts` (code source `isInside` correspondant).
- [x] `exampleSelector.ts` : sélecteur d'exemple qui précharge le code correspondant dans l'éditeur.

## Phase 3 — UI de paramètres

- [x] `boundsForm.ts` : champs `xMin/xMax`, `yMin/yMax`, `zMin/zMax`, `step`, avec validation (bornes cohérentes, pas > 0).
- [x] Affichage en direct du nombre de voxels estimé à partir des paramètres saisis.
- [x] Bouton "Générer" déclenchant le pipeline (transpilation → worker → meshing → affichage).
- [x] `progress.ts` : barre/indicateur de progression pendant le calcul dans le worker, avec possibilité d'annuler.

## Phase 4 — Viewer 3D

*Réalisée avant les phases 2-3 (choix : voir le moteur voxel à l'écran au plus tôt).*

- [x] `scene.ts` : setup three.js (scène, caméra perspective, lumières, `OrbitControls`).
- [x] Grid helper pour repère visuel (redimensionné/positionné sous le volume).
- [x] Affichage de la géométrie générée (remplacement propre du mesh précédent à chaque nouvelle génération).
- [x] `resize.ts` : gestion du redimensionnement du canvas/fenêtre (`ResizeObserver`).
- [x] Cadrage automatique de la caméra sur le volume généré (fit-to-bounds).

## Phase 5 — Export STL / GLB

- [x] `exportStl.ts` : intégration `STLExporter`, export binaire, déclenchement du téléchargement (`Blob` + lien `download`).
- [x] `exportGlb.ts` : intégration `GLTFExporter`, export `.glb`, déclenchement du téléchargement.
- [x] Boutons d'export dans l'UI, désactivés tant qu'aucun modèle n'a été généré.
- [x] Nommage des fichiers exportés (horodatage + nom d'exemple, ex. `voxelcad-sphere-20260717-064746.stl`).

## Phase 6 — Build single-file

- [ ] Vérifier que `npm run build` produit bien un unique `dist/index.html` fonctionnel, y compris les workers (sampler + workers internes de Monaco).
- [ ] Tester le fichier généré en ouverture directe (`file://`) et/ou via `npm run preview`, sans connexion réseau.
- [ ] Mesurer la taille du bundle final, documenter le résultat (attendu : plusieurs Mo à cause de Monaco, cf. DECISIONS.md).

## Phase 7 — Polish

- [ ] Gestion des cas limites de perf (grosses grilles) : messages d'avertissement clairs, annulation propre.
- [ ] Responsive de base (mise en page éditeur/viewer/formulaire).
- [ ] Revue des messages d'erreur utilisateur (compilation TS, exécution `isInside`, bornes invalides).
- [ ] Mise à jour finale du README (captures d'écran optionnelles, instructions d'usage).
- [ ] (Optionnel) Tests end-to-end basiques (ex. Playwright) sur le parcours "choisir un exemple → générer → exporter".
