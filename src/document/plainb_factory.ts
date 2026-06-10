import type { ISharedNotebook } from '@jupyter/ydoc';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookContent } from '@jupyterlab/nbformat';
import {
  INotebookModel,
  NotebookModel,
  NotebookModelFactory
} from '@jupyterlab/notebook';
import { Contents, KernelSpec } from '@jupyterlab/services';
import { detectFormat, parseFormat, serializeFormat } from 'plainb';
import type { Notebook, PlainbFormat } from 'plainb';

/**
 * Pick an available kernel whose language matches, preferring the default one.
 */
function kernelspecForLanguage(
  specs: KernelSpec.ISpecModels | null,
  language: string
): Record<string, string> | undefined {
  if (!specs?.kernelspecs) {
    return undefined;
  }
  const normLang = language.toLowerCase();
  const candidates = specs.default
    ? [specs.default, ...Object.keys(specs.kernelspecs)]
    : Object.keys(specs.kernelspecs);
  for (const name of candidates) {
    const spec = specs.kernelspecs[name];
    if (spec && spec.language.toLowerCase() === normLang) {
      return {
        name: spec.name,
        display_name: spec.display_name,
        language: spec.language
      };
    }
  }
  return undefined;
}

class PlainbNotebookModel extends NotebookModel {
  constructor(
    options: NotebookModel.IOptions,
    ext: string,
    kernelSpecManager: KernelSpec.IManager
  ) {
    super(options);
    this._ext = ext;
    this._kernelSpecManager = kernelSpecManager;
  }

  fromString(value: string): void {
    this._format = detectFormat(value, this._ext);
    const notebook = parseFormat(value, this._format) as any;
    notebook.metadata = notebook.metadata ?? {};

    if (!notebook.metadata.kernelspec) {
      const language = notebook.metadata.language_info?.name || 'python';
      const kernelspec = kernelspecForLanguage(
        this._kernelSpecManager.specs,
        language
      );
      if (kernelspec) {
        notebook.metadata.kernelspec = kernelspec;
        notebook.metadata.language_info = notebook.metadata.language_info ?? {
          name: kernelspec.language
        };
      }
    }

    super.fromJSON(notebook as INotebookContent);
  }

  toString(): string {
    return serializeFormat(super.toJSON() as unknown as Notebook, this._format);
  }

  private _ext: string;
  private _format: PlainbFormat = 'percent';
  private _kernelSpecManager: KernelSpec.IManager;
}

export class PlainbNotebookModelFactory extends NotebookModelFactory {
  constructor(options: {
    name: string;
    ext: string;
    kernelSpecManager: KernelSpec.IManager;
  }) {
    super();
    this._name = options.name;
    this._ext = options.ext;
    this._kernelSpecManager = options.kernelSpecManager;
  }

  get name(): string {
    return this._name;
  }

  get contentType(): Contents.ContentType {
    return 'file';
  }

  get fileFormat(): Contents.FileFormat {
    return 'text';
  }

  createNew(
    options: DocumentRegistry.IModelOptions<ISharedNotebook> = {}
  ): INotebookModel {
    return new PlainbNotebookModel(
      {
        languagePreference: options.languagePreference,
        sharedModel: options.sharedModel,
        collaborationEnabled:
          options.collaborationEnabled && this.collaborative,
        disableDocumentWideUndoRedo: this.disableDocumentWideUndoRedo
      },
      this._ext,
      this._kernelSpecManager
    );
  }

  private _name: string;
  private _ext: string;
  private _kernelSpecManager: KernelSpec.IManager;
}
