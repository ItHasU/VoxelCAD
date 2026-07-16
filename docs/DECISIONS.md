# Décisions techniques

Journal des choix structurants du projet, au format léger (contexte / décision / conséquences). À compléter au fil du développement.

## 1. Build & serveur de dev : Vite + vite-plugin-singlefile

**Contexte** : il faut une chaîne de compilation TypeScript, un serveur de dev avec watch/refresh automatique, et un build de production produisant un unique fichier HTML autonome.

**Décision** : utiliser Vite. En dev, son serveur intégré fournit watch + HMR nativement (pas besoin de coder un serveur maison). En production, le plugin [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile) inline le JS/CSS générés directement dans `dist/index.html`.

**Conséquences** :
- Pas de code de serveur/watch à maintenir nous-mêmes.
- Le plugin single-file impose certaines contraintes (pas de code-splitting dynamique classique, les imports dynamiques doivent être inlinés) — à vérifier notamment pour le worker d'exécution (voir décision 4) et pour Monaco (workers de langage).
- Écosystème mature, beaucoup de plugins Vite disponibles si besoin (ex. plugin worker).

## 2. Éditeur de code intégré : Monaco Editor

**Contexte** : l'utilisateur doit écrire `isInside(x, y, z): boolean` dans un éditeur intégré à la page.

**Décision** : utiliser Monaco Editor (le moteur de VS Code) plutôt que CodeMirror.

**Conséquences** :
- Autocomplétion et vérification de types TypeScript de bonne qualité, cohérent avec la décision 3 (TypeScript complet pour `isInside`).
- Empreinte notable dans le bundle (plusieurs Mo) : le fichier HTML autonome final sera lourd. Accepté comme compromis assumé au profit de l'expérience d'édition.
- Monaco embarque déjà en interne le compilateur/language-service TypeScript (`monaco-editor/esm/vs/language/typescript`). On le réutilise pour la transpilation (décision 3) plutôt que d'ajouter une deuxième dépendance `typescript` séparée.
- Monaco utilise des web workers pour son language service ; il faudra vérifier leur bon fonctionnement une fois inlinés par `vite-plugin-singlefile` (fallback possible : `MonacoEnvironment.getWorker` avec workers en blob URL).

## 3. Langage de la fonction utilisateur : TypeScript complet

**Contexte** : le code que l'utilisateur écrit dans l'éditeur pour `isInside` peut être du JavaScript simple ou du vrai TypeScript typé.

**Décision** : accepter du TypeScript complet.

**Conséquences** :
- Nécessite une transpilation TS → JS avant exécution. On réutilise le language service déjà embarqué dans Monaco (`getEmitOutput` du worker TS de Monaco) pour éviter d'embarquer une deuxième copie du compilateur TypeScript.
- Erreurs de compilation TypeScript affichées directement dans l'éditeur (diagnostics Monaco) avant même de tenter l'exécution.
- Le code émis (JS) est ensuite exécuté dans le Web Worker d'exécution (décision 4).

## 4. Sandbox d'exécution : Web Worker dédié

**Contexte** : `isInside` est appelée potentiellement des centaines de milliers de fois (grille 3D). L'exécuter sur le thread principal bloquerait l'UI.

**Décision** : exécuter le code utilisateur transpilé dans un Web Worker dédié à l'échantillonnage de la grille, avec envoi de messages de progression au thread principal.

**Conséquences** :
- L'UI reste réactive pendant le calcul (barre de progression, possibilité d'annuler).
- Ce n'est pas un sandbox de sécurité complet (le code tourne toujours dans la même origine, avec accès à `postMessage`, `fetch`, etc.) : le modèle de menace retenu est « l'utilisateur exécute son propre code localement », pas « protection contre du code hostile tiers ». À documenter clairement dans l'UI si le projet est un jour déployé en usage multi-utilisateurs.
- Sous `vite-plugin-singlefile`, le worker doit être inliné (ex. `new Worker(URL.createObjectURL(new Blob([code])))` ou plugin dédié) plutôt que chargé comme fichier séparé.
- Prévoir un garde-fou sur le nombre total de voxels (déduit de `(bornes / pas)` sur les 3 axes) pour avertir/bloquer avant un calcul trop long.

## 5. Stratégie de rendu voxel : culling des faces internes

**Contexte** : générer un `BoxGeometry` indépendant par voxel plein est très inefficace dès que la grille dépasse quelques milliers de cellules (trop de triangles, y compris des faces totalement invisibles entre deux voxels adjacents).

**Décision** : générer un maillage par « voxel meshing » façon Minecraft : pour chaque voxel plein, on n'émet une face que si le voxel voisin correspondant est vide (ou hors grille). Le résultat est fusionné en une géométrie unique (`BufferGeometryUtils.mergeGeometries`) pour l'affichage et l'export.

**Conséquences** :
- Réduction drastique du nombre de triangles pour des volumes pleins (intérieur non maillé).
- Algorithme simple à implémenter en V1 (comparaison des 6 voisins par voxel plein) ; une évolution possible plus tard est le *greedy meshing* (fusion de faces coplanaires adjacentes) si les performances deviennent un problème sur de grosses grilles — non retenu en V1 pour limiter la complexité initiale.
- Le viewer (affichage) et l'export STL/GLB partagent la même géométrie fusionnée : pas de double implémentation.

## 6. Export STL / GLB : addons three.js

**Contexte** : il faut exporter le modèle généré en `.stl` et `.glb`.

**Décision** : utiliser les exporters officiels des examples de three.js : `STLExporter` et `GLTFExporter` (import depuis `three/examples/jsm/exporters/...`).

**Conséquences** :
- Pas de logique d'export à réécrire à la main, formats bien supportés par le reste de l'écosystème 3D.
- Le GLB est un format binaire unique (facile à télécharger en un seul fichier), le STL peut être exporté en binaire pour limiter la taille.

## 7. Pas de framework UI

**Contexte** : l'interface reste simple (éditeur, formulaire de bornes/pas, viewer, boutons d'export/exemples).

**Décision** : DOM/TypeScript vanilla, sans React/Vue/Svelte.

**Conséquences** :
- Évite d'alourdir davantage un bundle déjà conséquent à cause de Monaco.
- Nécessite un peu plus de code de gestion d'état manuel, acceptable vu la taille limitée de l'UI (quelques panneaux).
- Réévaluer cette décision si l'UI grossit significativement en cours de projet.
