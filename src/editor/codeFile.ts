import { downloadBlob } from '../export/download';

/** Enregistre le code de l'éditeur dans un fichier `.ts` téléchargé. */
export function saveCode(code: string, filename: string): void {
  downloadBlob(code, filename, 'text/typescript');
}

/**
 * Ouvre un sélecteur de fichier et renvoie le contenu texte du fichier choisi
 * (`.ts` / `.txt`), ou `null` si l'utilisateur annule.
 */
export function loadCodeFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ts,.txt,text/plain,text/typescript';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    });
    // Si l'utilisateur ferme la boîte sans choisir, on ne résout jamais côté
    // « change » ; on s'appuie sur le fait qu'un nouvel appel recrée un input.
    input.click();
  });
}
