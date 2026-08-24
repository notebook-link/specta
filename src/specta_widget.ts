import { CellList } from '@jupyterlab/notebook';
import { PromiseDelegate } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { Panel, Widget } from '@lumino/widgets';

import { SpectaCellOutput } from './specta_cell_output';
import {
  IAppModel,
  IAppWidget,
  ISpectaAppConfig,
  ISpectaLayout,
  ISpectaLayoutRegistry
} from './token';
import {
  emitResizeEvent,
  hideAppLoadingIndicator,
  isSpectaApp,
  nextFrame
} from './tool';
import { captureSnapshot } from './snapshot';

export class AppWidget extends Panel implements IAppWidget {
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
      if (!this._model.staticRender) {
        this.rerender(newCells);
      }
    });
  }

  /**
   * A promise that is fulfilled when the model is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  get model(): IAppModel {
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
    let index = 0;
    for (const cell of cellList) {
      const src = cell.sharedModel.source;
      if (src.length === 0) {
        index++;
        continue;
      }
      const el = this._model.createCell(cell);
      el.info.cellIndex = index++;
      el.executionDone = this._model
        .executeCell(cell, el)
        .then(() => undefined)
        .catch(() => undefined);
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
      notebook: this._model.sandboxContext?.model.toJSON() as any,
      readyCallback,
      spectaConfig: this._spectaAppConfig
    });
  }

  async rerender(newCells?: CellList): Promise<void> {
    if (!newCells) {
      newCells = this.model.cells;
    }
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
      notebook: this._model.sandboxContext?.model.toJSON() as any,
      readyCallback: async () => {},
      spectaConfig: this._spectaAppConfig
    });

    emitResizeEvent();
    this.removeSpinner();
  }

  async turnOffStaticRender(): Promise<void> {
    if (!this._model.staticRender) {
      return;
    }
    await this._model.turnOffStaticRender();
    await this.rerender();
  }

  async saveSnapshot(): Promise<number | undefined> {
    if (this._model.staticRender) {
      return;
    }
    if (this._model.resyncSandbox()) {
      await this.rerender();
    }
    const outputs = this._outputs;
    await Promise.all(outputs.map(el => el.executionDone));
    if (outputs !== this._outputs) {
      // A rerender landed while we were waiting; these widgets are disposed.
      return;
    }
    await nextFrame();
    const sandbox = this._model.sandboxContext;
    if (!sandbox) {
      return;
    }
    const snapshot = await captureSnapshot({ sandbox, outputs });
    await this._model.saveSnapshotToMetadata(snapshot);
    return snapshot.timestamp;
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
      notebook: this._model.sandboxContext?.model.toJSON() as any,
      readyCallback: async () => {},
      spectaConfig: this._spectaAppConfig
    });
  }
  private _model: IAppModel;

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
    model: IAppModel;
    layoutRegistry: ISpectaLayoutRegistry;
    spectaConfig: ISpectaAppConfig;
  }
}
