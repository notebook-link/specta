import { Dialog, showDialog } from '@jupyterlab/apputils';
import {
  CodeCell,
  CodeCellModel,
  ICellModel,
  MarkdownCell,
  MarkdownCellModel,
  RawCell,
  RawCellModel
} from '@jupyterlab/cells';
import {
  IEditorMimeTypeService,
  IEditorServices
} from '@jupyterlab/codeeditor';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
  CellList,
  INotebookModel,
  INotebookTracker,
  NotebookPanel,
  StaticNotebook
} from '@jupyterlab/notebook';
import { OutputAreaModel, SimplifiedOutputArea } from '@jupyterlab/outputarea';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { KernelSpec, ServiceManager } from '@jupyterlab/services';
import { PromiseDelegate, UUID } from '@lumino/coreutils';

import {
  createNotebookContext,
  createNotebookPanel
} from './create_notebook_panel';
import { SpectaCellOutput } from './specta_cell_output';
import { emitResizeEvent, readCellConfig } from './tool';
import {
  ISpectaSnapshotData,
  SPECTA_SNAPSHOT_KEY,
  WIDGET_STATE_MIMETYPE,
  parseSnapshot,
  snapshotHash
} from './snapshot';

import { ISignal, Signal } from '@lumino/signaling';
import { INotebookContent } from '@jupyterlab/nbformat';
import { IAppModel, ISpectaAppConfig, ISpectaSnapshotStatus } from './token';

export class AppModel implements IAppModel {
  constructor(private options: AppModel.IOptions) {
    this._staticRender =
      Boolean(options.spectaConfig.enableStaticRendering) &&
      Boolean(this.getSnapshot());
    this._filePath = options.context.localPath;
    this._manager = options.manager;

    options.context.fileChanged.connect(() => {
      const cells = this.resyncSandbox();
      if (cells) {
        this._fileChanged.emit(cells);
      }
      this._snapshotChanged.emit();
    });
    this._kernelSpecManager = options.kernelSpecManager;
    const specs = this._kernelSpecManager.specs;
    this._kernelSpecManager.specsChanged.connect((_, b) => {
      this._kernelReady.resolve();
    });
    if (specs && Object.keys(specs.kernelspecs).length !== 0) {
      this._kernelReady.resolve();
    }
  }
  /**
   * Whether the handler is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get fileChanged(): ISignal<this, CellList> {
    return this._fileChanged;
  }

  get staticRender(): boolean {
    return this._staticRender;
  }
  get snapshotChanged(): ISignal<this, void> {
    return this._snapshotChanged;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._sandboxContext?.dispose();
    this._notebookPanel?.dispose();
    Signal.clearData(this);
  }

  get rendermime(): IRenderMimeRegistry {
    return this.options.rendermime;
  }

  get cells(): CellList | undefined {
    return this._sandboxContext?.model.cells;
  }

  /**
   * The sandbox context the preview renders from — a throwaway clone at a
   * random path whose `save()` is a no-op. Not the document context, which
   * lives at `options.context` and is what gets written to disk.
   */
  get sandboxContext(): DocumentRegistry.IContext<INotebookModel> | undefined {
    return this._sandboxContext;
  }
  get panel(): NotebookPanel | undefined {
    return this._notebookPanel;
  }
  async initialize(): Promise<void> {
    let snapshot = this._staticRender ? this.getSnapshot() : undefined;
    if (this._staticRender && !snapshot) {
      // Unreadable snapshot, wrong version, or malformed.
      this._staticRender = false;
    }
    if (snapshot && this.snapshotStatus() === 'out-of-sync') {
      const response = await showDialog({
        body: 'Do you want to use existing cache or re-run the notebook using a kernel?',
        title: 'Render cache out of sync',
        buttons: [
          Dialog.cancelButton({ label: 'Use cache' }),
          Dialog.okButton({ label: 'Render with kernel' })
        ]
      });
      if (response.button.accept) {
        this._staticRender = false;
        snapshot = undefined;
      }
    }
    const kernelPreference = {
      shouldStart: !this._staticRender,
      canStart: !this._staticRender,
      shutdownOnDispose: !this._staticRender,
      name: this.options.context.model.defaultKernelName,
      autoStartDefault: !this._staticRender,
      language: this.options.context.model.defaultKernelLanguage
    };
    this._sandboxContext = await createNotebookContext({
      manager: this._manager,
      kernelPreference: kernelPreference,
      filePath: this._filePath
    });
    this._sandboxJson = undefined;
    if (this._staticRender && snapshot) {
      const notebookModel = snapshot.notebook;
      notebookModel.metadata['widgets'] = {
        [WIDGET_STATE_MIMETYPE]: snapshot.widgetStates
      } as any;

      this._sandboxContext.model.fromJSON(notebookModel);
      this._notebookPanel = createNotebookPanel({
        context: this._sandboxContext!,
        rendermime: this.options.rendermime,
        editorServices: this.options.editorServices
      });
      await this._sandboxContext.sessionContext.initialize();

      (this._sandboxContext.sessionContext as any)._session = {
        dispose: () => {},
        kernel: {
          id: UUID.uuid4(),
          registerCommTarget: () => {},
          handleComms: false,
          requestCommInfo: async () => ({ content: { status: undefined } })
        }
      };

      (this.options.tracker as any).add(this._notebookPanel);
    } else {
      this.resyncSandbox();
      this._notebookPanel = createNotebookPanel({
        context: this._sandboxContext!,
        rendermime: this.options.rendermime,
        editorServices: this.options.editorServices
      });
      (this.options.tracker as any).add(this._notebookPanel);
      await this._sandboxContext.sessionContext.initialize();
    }
    this._snapshotChanged.emit();
  }

  createCell(cellModel: ICellModel): SpectaCellOutput {
    let item: SpectaCellOutput;
    const cellModelJson = cellModel.toJSON();
    const info = {
      cellModel: cellModelJson
    };
    const cellConfig = readCellConfig(cellModelJson);
    switch (cellModel.type) {
      case 'code': {
        let sourceCell: CodeCell | undefined;

        cellModel.sharedModel.transact(() => {
          (cellModel as CodeCellModel).clearExecution();
        }, false);
        if (cellConfig.showSource) {
          sourceCell = new CodeCell({
            model: cellModel as CodeCellModel,
            rendermime: this.options.rendermime,
            contentFactory: this.options.contentFactory,
            editorConfig: {
              lineNumbers: false,
              lineWrap: false,
              tabFocusable: false,
              editable: false
            }
          });
          sourceCell.syncEditable = false;
          sourceCell.readOnly = true;
        }

        const outputareamodel = new OutputAreaModel({ trusted: true });

        if (this._staticRender && cellModelJson.outputs) {
          outputareamodel.fromJSON(cellModelJson.outputs as any);
        }
        const out = new SimplifiedOutputArea({
          model: outputareamodel,
          rendermime: this.options.rendermime
        });

        item = new SpectaCellOutput({
          cellIdentity: cellModel.id,
          cell: out,
          sourceCell,
          cellConfig,
          info
        });

        break;
      }
      case 'markdown': {
        const markdownCell = new MarkdownCell({
          model: cellModel as MarkdownCellModel,
          rendermime: this.options.rendermime,
          contentFactory: this.options.contentFactory,
          editorConfig: this.options.editorConfig.markdown
        });
        markdownCell.initializeState();
        markdownCell.inputHidden = false;
        markdownCell.rendered = true;
        Private.removeElements(markdownCell.node, 'jp-Collapser');
        Private.removeElements(markdownCell.node, 'jp-InputPrompt');
        item = new SpectaCellOutput({
          cellIdentity: cellModel.id,
          cell: markdownCell,
          info,
          cellConfig
        });
        break;
      }
      default: {
        const rawCell = new RawCell({
          model: cellModel as RawCellModel,
          contentFactory: this.options.contentFactory,
          editorConfig: this.options.editorConfig.raw
        });
        rawCell.inputHidden = false;
        Private.removeElements(rawCell.node, 'jp-Collapser');
        Private.removeElements(rawCell.node, 'jp-InputPrompt');
        item = new SpectaCellOutput({
          cellIdentity: cellModel.id,
          cell: rawCell,
          info,
          cellConfig
        });
        break;
      }
    }

    return item;
  }

  async setEnableStaticRendering(value: boolean): Promise<void> {
    const currentSpectaConfig =
      this.options.context.model.getMetadata('specta');
    currentSpectaConfig.enableStaticRendering = value ? 'Yes' : 'No';
    this.options.context.model.setMetadata('specta', currentSpectaConfig);
    await this.options.context.save();
    this.options.context.model.dirty = false;
    this._snapshotChanged.emit();
  }

  async turnOffStaticRender(): Promise<void> {
    if (!this._staticRender) {
      return;
    }
    this._staticRender = false;
    this._notebookPanel?.dispose();
    this._notebookPanel = undefined;
    this._sandboxContext?.dispose();
    this._sandboxContext = undefined;
    await this.initialize();
    this._snapshotChanged.emit();
  }

  /**
   * Bring the sandbox in line with the document, if it has drifted.
   *
   * Returns the re-seeded cell list, or `undefined` when the sandbox already
   * matches — which is the case for metadata-only writes such as our own
   * snapshot save, so those no longer re-execute the notebook.
   */
  resyncSandbox(): CellList | undefined {
    if (!this._sandboxContext || this._staticRender) {
      return undefined;
    }
    const json = this._documentJson();
    const serialized = JSON.stringify(json);
    if (serialized === this._sandboxJson) {
      return undefined;
    }
    this._sandboxJson = serialized;
    this._sandboxContext.model.fromJSON(json);
    return this._sandboxContext.model.cells;
  }

  async executeCell(
    cell: ICellModel,
    outputWrapper: SpectaCellOutput
  ): Promise<any> {
    if (cell.type !== 'code' || !this._sandboxContext) {
      return;
    }

    if (this._staticRender) {
      outputWrapper.removePlaceholder();
      return;
    }
    const specs = this._kernelSpecManager.specs;
    if (specs && Object.keys(specs.kernelspecs).length !== 0) {
      this._kernelReady.resolve();
    } else {
      await this._kernelReady.promise;
    }
    const output = outputWrapper.cellOutput as SimplifiedOutputArea;

    const source = cell.sharedModel.source;
    const rep = await SimplifiedOutputArea.execute(
      source,
      output,
      this._sandboxContext.sessionContext
    );
    output.future.done.then(() => {
      emitResizeEvent();
      outputWrapper.removePlaceholder();
    });
    return Promise.all([rep, output.future.done]);
  }

  getSnapshot(): ISpectaSnapshotData | undefined {
    return parseSnapshot(
      this.options.context.model.getMetadata(SPECTA_SNAPSHOT_KEY)
    );
  }

  snapshotStatus(): ISpectaSnapshotStatus {
    const sn = this.getSnapshot();
    if (!sn) {
      return 'not-exist';
    }

    const documentHash = snapshotHash(
      Array.from(this.options.context.model.cells, cell =>
        cell.sharedModel.getSource()
      )
    );
    return documentHash === sn.hash ? 'in-sync' : 'out-of-sync';
  }
  async saveSnapshotToMetadata(snapshot: ISpectaSnapshotData): Promise<void> {
    this.options.context.model.setMetadata(SPECTA_SNAPSHOT_KEY, snapshot);
    await this.options.context.save();
    this.options.context.model.dirty = false;
    this._snapshotChanged.emit();
  }

  async deleteSnapshot(): Promise<void> {
    this.options.context.model.deleteMetadata(SPECTA_SNAPSHOT_KEY);
    await this.options.context.save();
    this.options.context.model.dirty = false;
    this._snapshotChanged.emit();
  }

  private _documentJson(): INotebookContent {
    const json = this.options.context.model.toJSON() as INotebookContent;
    // sandbox context does not need metadata, this is to avoid
    // reloading specta view when changing specta metadata
    delete json.metadata['specta'];
    delete json.metadata[SPECTA_SNAPSHOT_KEY];
    return json;
  }

  private _kernelReady = new PromiseDelegate<void>();

  private _notebookPanel?: NotebookPanel;
  private _sandboxContext?: DocumentRegistry.IContext<INotebookModel>;

  private _isDisposed = false;
  private _manager: ServiceManager.IManager;
  private _fileChanged = new Signal<this, CellList>(this);
  private _filePath: string;
  private _kernelSpecManager: KernelSpec.IManager;
  private _staticRender = false;
  private _sandboxJson?: string;

  private _snapshotChanged = new Signal<this, void>(this);
}

export namespace AppModel {
  export interface IOptions {
    context: DocumentRegistry.IContext<INotebookModel>;
    manager: ServiceManager.IManager;
    rendermime: IRenderMimeRegistry;
    tracker: INotebookTracker;
    contentFactory: NotebookPanel.IContentFactory;
    mimeTypeService: IEditorMimeTypeService;
    editorConfig: StaticNotebook.IEditorConfig;
    notebookConfig: StaticNotebook.INotebookConfig;
    editorServices: IEditorServices;
    kernelSpecManager: KernelSpec.IManager;
    spectaConfig: ISpectaAppConfig;
  }
}

namespace Private {
  /**
   * Remove children by className from an HTMLElement.
   */
  export function removeElements(node: HTMLElement, className: string): void {
    const elements = node.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
      elements[i].remove();
    }
  }
}
