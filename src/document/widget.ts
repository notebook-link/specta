import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import { DocumentWidget } from '@jupyterlab/docregistry';
import {
  INotebookModel,
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ServiceManager } from '@jupyterlab/services';
import { Widget } from '@lumino/widgets';

export interface ISpectaOptions {
  manager: ServiceManager;
  rendermime: IRenderMimeRegistry;
  tracker: INotebookTracker;
  contentFactory: NotebookPanel.IContentFactory;
  mimeTypeService: IEditorMimeTypeService;
}

export class NotebookSpectaDocWidget extends DocumentWidget<
  Widget,
  INotebookModel
> {
  constructor(options: DocumentWidget.IOptions<Widget, INotebookModel>) {
    super(options);
  }

  dispose(): void {
    this.content.dispose();
    super.dispose();
  }
}
