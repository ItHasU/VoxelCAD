import * as monaco from 'monaco-editor';
import { typescript as monacoTs } from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline';
import { getTheme, onThemeChange, type Theme } from '../ui/theme';
import { VCAD_AMBIENT } from './vcadTypes';

// Workers inline pour rester compatibles avec le build single-file.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// Types de référence disponibles pour l'utilisateur (vcad, Solid, isInside),
// sans imposer d'import.
const AMBIENT_LIB = VCAD_AMBIENT;

function monacoThemeFor(theme: Theme): string {
  return theme === 'dark' ? 'vs-dark' : 'vs';
}

let configured = false;

function configureTypeScript(): void {
  if (configured) return;
  configured = true;

  const ts = monacoTs.typescriptDefaults;
  ts.setCompilerOptions({
    target: monacoTs.ScriptTarget.ES2020,
    lib: ['es2020'],
    strict: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    allowNonTsExtensions: true,
  });
  ts.addExtraLib(AMBIENT_LIB, 'ts:voxelcad-ambient.d.ts');
}

export interface EditorHandle {
  getValue(): string;
  setValue(code: string): void;
  getModelUri(): monaco.Uri;
  onDidChange(callback: () => void): void;
}

export function createEditor(container: HTMLElement, initialValue: string): EditorHandle {
  configureTypeScript();

  const editor = monaco.editor.create(container, {
    value: initialValue,
    language: 'typescript',
    theme: monacoThemeFor(getTheme()),
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    tabSize: 2,
    renderLineHighlight: 'line',
    smoothScrolling: true,
  });

  onThemeChange((theme) => monaco.editor.setTheme(monacoThemeFor(theme)));

  const model = editor.getModel()!;

  return {
    getValue: () => editor.getValue(),
    setValue: (code) => editor.setValue(code),
    getModelUri: () => model.uri,
    onDidChange: (callback) => {
      model.onDidChangeContent(() => callback());
    },
  };
}
