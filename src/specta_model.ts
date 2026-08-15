import { ISessionContext } from '@jupyterlab/apputils';
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
import { IExecuteReplyMsg } from '@jupyterlab/services/lib/kernel/messages';
import { PartialJSONValue, PromiseDelegate } from '@lumino/coreutils';

import {
  createNotebookContext,
  createNotebookPanel
} from './create_notebook_panel';
import { SpectaCellOutput } from './specta_cell_output';
import { emitResizeEvent, ISpectaSnapshotData, readCellConfig } from './tool';
import { ISignal, Signal } from '@lumino/signaling';

export class AppModel {
  constructor(private options: AppModel.IOptions) {
    this._notebookModelJson = options.context.model.toJSON();
    this._filePath = options.context.localPath;
    this._kernelPreference = {
      shouldStart: true,
      canStart: true,
      shutdownOnDispose: true,
      name: options.context.model.defaultKernelName,
      autoStartDefault: true,
      language: options.context.model.defaultKernelLanguage
    };
    this._manager = options.manager;
    options.context.fileChanged.connect(e => {
      this._fileChanged.emit(e.model.cells);
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
    this._context = await createNotebookContext({
      manager: this._manager,
      kernelPreference: this._kernelPreference,
      filePath: this._filePath
    });
    this._context.model.fromJSON(this._notebookModelJson);

    this._notebookPanel = createNotebookPanel({
      context: this._context!,
      rendermime: this.options.rendermime,
      editorServices: this.options.editorServices
    });
    (this.options.tracker as any).add(this._notebookPanel);
    await this._context.sessionContext.initialize();
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

  async executeCell(
    cell: ICellModel,
    outputWrapper: SpectaCellOutput
  ): Promise<IExecuteReplyMsg | undefined> {
    if (cell.type !== 'code' || !this._context) {
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
    return rep;
  }

  async saveSnapshotToMetadata(snapshot: ISpectaSnapshotData): Promise<void> {
    if (this.options.context) {
      console.log('saveSnapshotToMetadata', this.options.context.path);
      this.options.context.model.setMetadata('spectaSnapshot', snapshot);
      await this.options.context.save();
      this.options.context.model.dirty = false;
    }
  }
  private _kernelReady = new PromiseDelegate<void>();

  private _notebookPanel?: NotebookPanel;
  private _context?: DocumentRegistry.IContext<INotebookModel>;
  private _notebookModelJson: PartialJSONValue;
  private _isDisposed = false;
  private _manager: ServiceManager.IManager;
  private _kernelPreference: ISessionContext.IKernelPreference;
  private _fileChanged = new Signal<this, CellList>(this);
  private _filePath: string;
  private _kernelSpecManager: KernelSpec.IManager;
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
