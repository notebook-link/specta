import {
  IEditorMimeTypeService,
  IEditorServices
} from '@jupyterlab/codeeditor';
import {
  INotebookTracker,
  NotebookPanel,
  StaticNotebook,
  INotebookModel
} from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ServiceManager, KernelSpec } from '@jupyterlab/services';
import { AppModel } from './specta_model';
import { AppWidget } from './specta_widget';
import { UUID } from '@lumino/coreutils';
import { ISpectaLayoutRegistry } from './token';
import { readSpectaConfig } from './tool';

export class SpectaWidgetFactory {
  constructor(options: SpectaWidgetFactory.IOptions) {
    this._options = options;
  }

  async createNew(options: {
    context: DocumentRegistry.IContext<INotebookModel>;
  }): Promise<AppWidget> {
    const { context } = options;
    const rendermime = this._options.rendermime.clone({
      resolver: context.urlResolver
    });
    const spectaConfig = readSpectaConfig({
      nbMetadata: context.model.metadata,
      nbPath: context.contentsModel?.path
    });
    const model = new AppModel({
      context,
      manager: this._options.manager,
      rendermime,
      tracker: this._options.tracker,
      contentFactory: this._options.contentFactory,
      mimeTypeService: this._options.mimeTypeService,
      editorConfig: StaticNotebook.defaultEditorConfig,
      notebookConfig: StaticNotebook.defaultNotebookConfig,
      editorServices: this._options.editorServices,
      kernelSpecManager: this._options.kernelSpecManager
    });

    // Create the specta pane
    const panel = new AppWidget({
      id: UUID.uuid4(),
      label: '',
      model,
      layoutRegistry: this._options.spectaLayoutRegistry,
      spectaConfig
    });

    return panel;
  }
  private _options: SpectaWidgetFactory.IOptions;
}

export namespace SpectaWidgetFactory {
  export interface IOptions {
    manager: ServiceManager.IManager;
    rendermime: IRenderMimeRegistry;
    tracker: INotebookTracker;
    contentFactory: NotebookPanel.IContentFactory;
    mimeTypeService: IEditorMimeTypeService;
    editorServices: IEditorServices;
    spectaLayoutRegistry: ISpectaLayoutRegistry;
    kernelSpecManager: KernelSpec.IManager;
  }
}
