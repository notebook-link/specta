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
  INotebookContentWithSnapshot,
  snapshotHash
} from './snapshot/tools';
import { ISignal, Signal } from '@lumino/signaling';

export class AppModel {
  constructor(private options: AppModel.IOptions) {
    this._staticRender = Boolean(this.getSnapshot());
    this._filePath = options.context.localPath;
    this._manager = options.manager;

    options.context.fileChanged.connect(context => {
      if (!this._context || this._staticRender) {
        return;
      }
      this._context.model.fromJSON(this._documentJson());
      this._fileChanged.emit(this._context.model.cells);
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

  get staticRender() {
    return this._staticRender;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._context?.dispose();
    this._notebookPanel?.dispose();
  }

  get rendermime(): IRenderMimeRegistry {
    return this.options.rendermime;
  }

  get cells(): CellList | undefined {
    return this._context?.model.cells;
  }

  get context(): DocumentRegistry.IContext<INotebookModel> | undefined {
    return this._context;
  }
  get panel(): NotebookPanel | undefined {
    return this._notebookPanel;
  }
  async initialize(): Promise<void> {
    if (this._staticRender) {
      const snapshotStatus = this.snapshotStatus();
      if (snapshotStatus === 'out-of-sync') {
        const response = await showDialog({
          body: 'Do you want to use existing snapshot or re-run the notebook using a kernel?',
          title: 'Snapshot out of sync',
          buttons: [
            Dialog.cancelButton({ label: 'Continue' }),
            Dialog.okButton({ label: 'Activate kernel' })
          ]
        });
        if (response.button.accept) {
          this._staticRender = false;
        } else {
          this._staticRender = true;
        }
      }
    }
    const kernelPreference = {
      shouldStart: !this._staticRender,
      canStart: !this._staticRender,
      shutdownOnDispose: true,
      name: this.options.context.model.defaultKernelName,
      autoStartDefault: !this._staticRender,
      language: this.options.context.model.defaultKernelLanguage
    };
    this._context = await createNotebookContext({
      manager: this._manager,
      kernelPreference: kernelPreference,
      filePath: this._filePath
    });
    if (this._staticRender) {
      const snapshot = this.getSnapshot();
      if (!snapshot?.notebook) {
        throw new Error('Snapshot notebook not found');
      }
      const notebookModel = snapshot.notebook as INotebookContentWithSnapshot;

      notebookModel.metadata['widgets'] = {
        [WIDGET_STATE_MIMETYPE]: snapshot.widgetStates
      } as any;

      this._context.model.fromJSON(notebookModel);
      this._notebookPanel = createNotebookPanel({
        context: this._context!,
        rendermime: this.options.rendermime,
        editorServices: this.options.editorServices
      });
      await this._context.sessionContext.initialize();
      const kernelUUID = UUID.uuid4();
      (this._context.sessionContext as any)._session = {
        kernel: {
          id: kernelUUID,
          registerCommTarget: () => {},
          handleComms: false,
          requestCommInfo: async () => ({ content: { status: undefined } })
        }
      };

      (this.options.tracker as any).add(this._notebookPanel);
    } else {
      this._context.model.fromJSON(this._documentJson());
      this._notebookPanel = createNotebookPanel({
        context: this._context!,
        rendermime: this.options.rendermime,
        editorServices: this.options.editorServices
      });
      (this.options.tracker as any).add(this._notebookPanel);
      await this._context.sessionContext.initialize();
    }
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

  async turnOffStaticRender() {
    if (!this._staticRender) {
      return;
    }
    this._staticRender = false;
    this._notebookPanel?.dispose();

    await this.initialize();
  }

  async executeCell(
    cell: ICellModel,
    outputWrapper: SpectaCellOutput
  ): Promise<any> {
    if (cell.type !== 'code' || !this._context) {
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
      this._context.sessionContext
    );
    output.future.done.then(() => {
      emitResizeEvent();
      outputWrapper.removePlaceholder();
    });
    return Promise.all([rep, output.future.done]);
  }

  getSnapshot(): ISpectaSnapshotData | undefined {
    return this.options.context.model.getMetadata(
      SPECTA_SNAPSHOT_KEY
    ) as unknown as ISpectaSnapshotData | undefined;
  }

  snapshotStatus(): 'out-of-sync' | 'in-sync' | 'not-exist' {
    const sn = this.getSnapshot();
    if (!sn) {
      return 'not-exist';
    }

    const sources = Array.from(this.options.context.model.cells, cell =>
      cell.sharedModel.getSource()
    );
    return snapshotHash(sources) === sn.hash ? 'in-sync' : 'out-of-sync';
  }
  async saveSnapshotToMetadata(snapshot: ISpectaSnapshotData): Promise<void> {
    this.options.context.model.setMetadata(SPECTA_SNAPSHOT_KEY, snapshot);
    await this.options.context.save();
    this.options.context.model.dirty = false;
  }

  async deleteSnapshot(): Promise<void> {
    this.options.context.model.deleteMetadata(SPECTA_SNAPSHOT_KEY);
    await this.options.context.save();
    this.options.context.model.dirty = false;
  }

  private _documentJson(): INotebookContentWithSnapshot {
    const json =
      this.options.context.model.toJSON() as INotebookContentWithSnapshot;
    delete json.metadata[SPECTA_SNAPSHOT_KEY];
    return json;
  }

  private _kernelReady = new PromiseDelegate<void>();

  private _notebookPanel?: NotebookPanel;
  private _context?: DocumentRegistry.IContext<INotebookModel>;

  private _isDisposed = false;
  private _manager: ServiceManager.IManager;
  private _fileChanged = new Signal<this, CellList>(this);
  private _filePath: string;
  private _kernelSpecManager: KernelSpec.IManager;
  private _staticRender = false;
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
