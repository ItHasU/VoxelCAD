import type * as monaco from 'monaco-editor';
import { typescript as monacoTs } from 'monaco-editor';

export interface TranspileResult {
  js: string;
  diagnostics: string[];
}

/**
 * Transpile un modèle TypeScript existant en JavaScript via le language service
 * interne de Monaco, et renvoie les éventuels diagnostics de compilation.
 *
 * On opère sur le modèle de l'éditeur lui-même (plutôt qu'un modèle temporaire)
 * pour éviter que deux scripts TS déclarant `isInside` au niveau global
 * n'entrent en collision (« Duplicate function implementation »).
 */
export async function transpile(uri: monaco.Uri): Promise<TranspileResult> {
  const worker = await monacoTs.getTypeScriptWorker();
  const client = await worker(uri);
  const fileName = uri.toString();

  const [syntactic, semantic, emitOutput] = await Promise.all([
    client.getSyntacticDiagnostics(fileName),
    client.getSemanticDiagnostics(fileName),
    client.getEmitOutput(fileName),
  ]);

  const diagnostics = [...syntactic, ...semantic].map((d) => flattenDiagnosticMessage(d));
  const jsFile = emitOutput.outputFiles.find((f: { name: string }) => f.name.endsWith('.js'));

  return { js: jsFile?.text ?? '', diagnostics };
}

interface TsDiagnostic {
  messageText: string | { messageText: string; next?: unknown };
}

function flattenDiagnosticMessage(diagnostic: TsDiagnostic): string {
  const { messageText } = diagnostic;
  return typeof messageText === 'string' ? messageText : messageText.messageText;
}
