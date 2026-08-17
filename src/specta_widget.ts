import { CellList } from '@jupyterlab/notebook';
import { PromiseDelegate } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { Panel, Widget } from '@lumino/widgets';

import { SpectaCellOutput } from './specta_cell_output';
import { AppModel } from './specta_model';
import {
  ISpectaAppConfig,
  ISpectaLayout,
  ISpectaLayoutRegistry
} from './token';
import {
  computeHash,
  emitResizeEvent,
  hideAppLoadingIndicator,
  isSpectaApp
} from './tool';
import {
  ISpectaSnapshotData,
  IWidgetManagerLike,
  SPECTA_SNAPSHOT_KEY,
  WIDGET_VIEW_MIMETYPE
} from './snapshot/tools';
import { SimplifiedOutputArea } from '@jupyterlab/outputarea';
import { INotebookContent } from '@jupyterlab/nbformat';

export class AppWidget extends Panel {
  constructor(options: AppWidget.IOptions) {
    super();
    this.node.id = options.id;
    this.title.label = options.label;
    this.title.closable = true;
    this._model = options.model;
    this._spectaAppConfig = options.spectaConfig;
    this._layoutRegistry = options.layoutRegistry;
    this._host = new Panel();
    this._host.addClass('specta-output-host');
    this.addClass('specta-app-widget');
    this.addWidget(this._host);

    if (!isSpectaApp()) {
      // Not a specta app, add spinner
      this.addSpinner();
    }

    this._model.initialize().then(async () => {
      let waitTime = this._spectaAppConfig.executionDelay;
      if (!waitTime) {
        waitTime = 100;
      } else {
        console.log(`Waiting for ${waitTime}ms`);
      }
      await new Promise(resolve =>
        setTimeout(resolve, parseInt(waitTime + ''))
      );
      await this.render();
      emitResizeEvent();
    });
    this._layoutRegistry.selectedLayoutChanged.connect(
      this._onSelectedLayoutChanged,
      this
    );
    this._model.fileChanged.connect((_, newCells) => {
      this.rerender(newCells);
    });
  }

  /**
   * A promise that is fulfilled when the model is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  get model(): AppModel {
    return this._model;
  }

  addSpinner(): void {
    const loaderHost = (this._loaderHost = new Widget());
    loaderHost.addClass('specta-loader-host');
    const spinner = document.createElement('div');
    spinner.className = 'specta-loader';
    loaderHost.node.appendChild(spinner);
    const text = document.createElement('div');
    text.className = 'specta-loading-indicator-text';
    text.textContent = this._spectaAppConfig.loadingName ?? 'Loading Specta';
    loaderHost.node.appendChild(text);
    this.addWidget(loaderHost);
  }

  removeSpinner(): void {
    if (this._loaderHost) {
      this._loaderHost.node.style.opacity = '0';
      setTimeout(() => {
        this.layout?.removeWidget(this._loaderHost!);
      }, 100);
    } else {
      hideAppLoadingIndicator();
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._model.dispose();
    super.dispose();
  }

  async generateOutputs(cellList?: CellList): Promise<SpectaCellOutput[]> {
    const outs: SpectaCellOutput[] = [];
    if (!cellList) {
      return outs;
    }
    for (const cell of cellList) {
      const src = cell.sharedModel.source;
      if (src.length === 0) {
        continue;
      }
      const el = this._model.createCell(cell);
      this._model.executeCell(cell, el);

      outs.push(el);
    }
    return outs;
  }

  getLayout(): ISpectaLayout {
    const layout = this._spectaAppConfig?.defaultLayout ?? 'article';
    const spectaLayout =
      this._layoutRegistry.get(layout) ??
      this._layoutRegistry.getDefaultLayout();
    return spectaLayout;
  }

  async render(): Promise<void> {
    const cellList = this._model.cells;
    this._outputs = await this.generateOutputs(cellList);
    const spectaLayout = this.getLayout();
    const readyCallback = async () => this.removeSpinner();

    await spectaLayout.render({
      host: this._host,
      items: this._outputs,
      notebook: this._model.context?.model.toJSON() as any,
      readyCallback,
      spectaConfig: this._spectaAppConfig
    });
  }

  async rerender(newCells: CellList): Promise<void> {
    this.addSpinner();
    for (const element of this._outputs) {
      element.dispose();
    }

    const currentEls = [...this._host.widgets];
    currentEls.forEach(el => {
      this._host.layout?.removeWidget(el);
    });

    this._outputs = await this.generateOutputs(newCells);

    const spectaLayout = this.getLayout();

    await spectaLayout.render({
      host: this._host,
      items: this._outputs,
      notebook: this._model.context?.model.toJSON() as any,
      readyCallback: async () => {},
      spectaConfig: this._spectaAppConfig
    });

    emitResizeEvent();
    this.removeSpinner();
  }

  async saveSnapshot(): Promise<number | undefined> {
    if (this._model.staticRender) {
      return;
    }

    await Promise.all(
      this._outputs.map(it => {
        if ((it.cellOutput as any)?.future?.done) {
          return (it.cellOutput as SimplifiedOutputArea).future.done;
        }
        return Promise.resolve();
      })
    );
    const notebook = this._model.context?.model.toJSON() as INotebookContent;

    if (notebook.metadata?.[SPECTA_SNAPSHOT_KEY]) {
      delete notebook['metadata'][SPECTA_SNAPSHOT_KEY];
    }
    const allCodeSources = notebook.cells.map(it => it.source).join('\n');

    const timestamp = Date.now();
    const snapshot: ISpectaSnapshotData = {
      hash: computeHash(allCodeSources),
      timestamp,
      notebook,
      widgetStates: null
    };
    for (const [idx, el] of this._outputs.entries()) {
      if (el.info.hidden || el.info.cellModel?.cell_type !== 'code') {
        continue;
      }
      const output = el.cellOutput as SimplifiedOutputArea;

      const outputModels = output.model.toJSON();
      notebook.cells[idx].outputs = outputModels;
      if (!snapshot.widgetStates) {
        for (let index = 0; index < outputModels.length; index++) {
          const data =
            (outputModels[index]?.data as Record<string, unknown>) ?? {};
          const viewSpec = data[WIDGET_VIEW_MIMETYPE] as
            | {
                model_id?: string;
                version_major?: number;
                version_minor?: number;
              }
            | undefined;
          if (!viewSpec?.model_id) {
            continue;
          }

          const outputWidget = output.widgets[index];
          if (!outputWidget) {
            continue;
          }
          for (const child of outputWidget.children()) {
            const renderer = child as Widget & {
              mimeType?: string;
              _manager?: { promise: Promise<IWidgetManagerLike> };
            };
            if (renderer.mimeType !== WIDGET_VIEW_MIMETYPE) {
              continue;
            }
            if (renderer._manager) {
              try {
                const wm = await renderer._manager.promise;
                snapshot.widgetStates = await wm.get_state();
                break;
              } catch (e) {
                continue;
              }
            }
          }
          if (snapshot.widgetStates) {
            break;
          }
        }
      }
    }
    await this._model.saveSnapshotToMetadata(snapshot);
    return timestamp;
  }

  protected onCloseRequest(msg: Message): void {
    this._model.dispose();
    super.onCloseRequest(msg);
  }

  private _onSelectedLayoutChanged(
    sender: ISpectaLayoutRegistry,
    args: { name: string; layout: ISpectaLayout; oldLayout?: ISpectaLayout }
  ): void {
    const { layout } = args;

    const currentEls = [...this._host.widgets];

    currentEls.forEach(el => {
      this._host.layout?.removeWidget(el);
    });
    layout.render({
      host: this._host,
      items: this._outputs,
      notebook: this._model.context?.model.toJSON() as any,
      readyCallback: async () => {},
      spectaConfig: this._spectaAppConfig
    });
  }
  private _model: AppModel;

  private _ready = new PromiseDelegate<void>();

  private _host: Panel;

  private _layoutRegistry: ISpectaLayoutRegistry;

  private _loaderHost?: Widget;

  private _outputs: SpectaCellOutput[] = [];

  private _spectaAppConfig: ISpectaAppConfig;
}

export namespace AppWidget {
  export interface IOptions {
    id: string;
    label: string;
    model: AppModel;
    layoutRegistry: ISpectaLayoutRegistry;
    spectaConfig: ISpectaAppConfig;
  }
}
