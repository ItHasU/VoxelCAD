# VoxelCAD

Outil web pour générer des volumes 3D par échantillonnage voxel à partir d'une fonction de test écrite par l'utilisateur, les visualiser dans un viewer 3D, et les exporter en STL / GLB.

## Principe

1. L'utilisateur écrit une fonction TypeScript `isInside(x, y, z): boolean` dans un éditeur de code intégré à la page (Monaco Editor).
2. Il définit les bornes du volume (min/max sur X, Y, Z) et un pas de calcul.
3. L'outil échantillonne la grille 3D résultante : un champ signé est évalué à chaque sommet (la distance signée pour les formes `vcad`, sinon ±1 dedans/dehors).
4. La surface est convertie en maillage selon le **mode de maillage** choisi (sélecteur « Maillage » de la barre d'outils) : *Lissé (Surface Nets)* extrait l'isosurface (isovaleur 0) en triangles doux — plus de facettes cubiques —, ou *Cubes (voxels)* rend un cube plein par cellule intérieure (aspect en marches d'escalier). Le résultat est affiché dans un viewer 3D interactif (rotation, déplacement, zoom). Changer de mode re-maille instantanément, sans ré-échantillonner.
5. Le modèle peut être exporté en `.stl` ou `.glb`.

Des exemples de volumes sont fournis pour démarrer rapidement : cube, sphère, cylindre.

## API `vcad` (géométrie constructive)

Plutôt que d'écrire `isInside` à la main, on peut composer des formes avec la
bibliothèque `vcad`, disponible sans import dans l'éditeur. Chaque forme est un
champ de distance signée ; les opérations booléennes et les transformations se
chaînent, et le résultat s'assigne à `isInside` :

```ts
const isInside = vcad.sphere(5).translate(2, 2, 2);

const isInside = vcad
  .cube(8)
  .difference(vcad.sphere(5.2)) // creuse une sphère
  .union(vcad.torus(4, 1).rotateX(90));
```

- **Primitives** (centrées sur l'origine) : `sphere(r)`, `box(w, h, d)`,
  `cube(size)`, `cylinder(rayon, hauteur)` (axe Y), `torus(rayon, section)` (axe Y).
- **Booléens** : `union`, `intersection`, `difference` — en fonctions
  (`vcad.union(a, b)`) ou en méthodes chaînées (`a.union(b)`).
- **Transformations** : `translate(dx, dy, dz)`, `scale(s)` ou `scale(sx, sy, sz)`,
  `rotateX/rotateY/rotateZ(degrés)`.
- **Bonus** : `shell(épaisseur)` (coque creuse), `round(rayon)` (arêtes arrondies),
  `distance(x, y, z)` (distance signée brute).

> Le résultat de `vcad` se déclare avec `const isInside = …` (ou `function isInside(…)`
> pour la forme manuelle). Voir `src/voxel/vcad.ts`.

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

Phases 0 à 5 terminées : l'application est utilisable de bout en bout (écrire `isInside` dans l'éditeur Monaco → régler les bornes → générer → visualiser en 3D → exporter en STL/GLB), avec un thème clair/sombre. Reste le polish (phase 7). Voir [docs/TASKS.md](docs/TASKS.md) pour l'avancement.
