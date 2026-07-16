# VoxelCAD

Outil web pour générer des volumes 3D par échantillonnage voxel à partir d'une fonction de test écrite par l'utilisateur, les visualiser dans un viewer 3D, et les exporter en STL / GLB.

## Principe

1. L'utilisateur écrit une fonction TypeScript `isInside(x, y, z): boolean` dans un éditeur de code intégré à la page (Monaco Editor).
2. Il définit les bornes du volume (min/max sur X, Y, Z) et un pas de calcul.
3. L'outil échantillonne la grille 3D résultante : pour chaque cellule, `isInside` détermine si un cube plein (de la taille du pas) doit être généré à cet endroit.
4. Le maillage voxel résultant est affiché dans un viewer 3D interactif (rotation, déplacement, zoom).
5. Le modèle peut être exporté en `.stl` ou `.glb`.

Des exemples de volumes sont fournis pour démarrer rapidement : cube, sphère, cylindre.

## Stack technique

- **TypeScript** de bout en bout.
- **Vite** comme chaîne de build : dev server avec watch/HMR natif, et build de production produisant un unique fichier HTML autonome (HTML + CSS + JS inlinés) via `vite-plugin-singlefile`.
- **Monaco Editor** pour l'édition de code intégrée (coloration, autocomplétion, vérification de types TypeScript).
- **three.js** pour le rendu 3D (scène, `OrbitControls`, export `STLExporter` / `GLTFExporter`).
- Pas de framework UI : DOM/TypeScript vanilla, pour garder le bundle single-file raisonnable.

Le détail des choix techniques et leurs justifications est dans [docs/DECISIONS.md](docs/DECISIONS.md). L'architecture (modules, flux de données, algorithme de meshing voxel) est dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). La liste des tâches est dans [docs/TASKS.md](docs/TASKS.md).

## Démarrage

```bash
npm install
npm run dev      # serveur de dev Vite avec watch + refresh automatique
npm run build    # génère dist/index.html (fichier HTML autonome)
npm run preview  # sert le build de production en local
npm run lint      # ESLint
npm run format    # Prettier
```

`npm test` (Vitest) sera ajouté en Phase 1 avec le moteur voxel.

## Statut

Phases 0 à 4 terminées : l'application est utilisable de bout en bout (écrire `isInside` dans l'éditeur Monaco → régler les bornes → générer → visualiser en 3D), avec un thème clair/sombre. Reste l'export STL/GLB (phase 5) et le polish (phase 7). Voir [docs/TASKS.md](docs/TASKS.md) pour l'avancement.
