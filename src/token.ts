import { Token } from '@lumino/coreutils';
import { Panel, Widget } from '@lumino/widgets';
import { SpectaCellOutput } from './specta_cell_output';
import * as nbformat from '@jupyterlab/nbformat';
import { ISignal } from '@lumino/signaling';
import { IDisposable } from '@lumino/disposable';
import { IWidgetTracker } from '@jupyterlab/apputils';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { ICellModel } from '@jupyterlab/cells';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { CellList, INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import type { ISpectaSnapshotData } from './snapshot';

export interface ISpectaShell extends JupyterFrontEnd.IShell {
  hideTopBar: () => void;
}
export interface ISpectaLayout {
  render(options: {
    host: Panel;
    items: SpectaCellOutput[];
    notebook: nbformat.INotebookContent;
    readyCallback: () => Promise<void>;
    spectaConfig: ISpectaAppConfig;
  }): Promise<void>;
}
export interface ISpectaLayoutRegistry {
  get(name: string): ISpectaLayout | undefined;
  getDefaultLayout(): ISpectaLayout;
  register(name: string, layout: ISpectaLayout): void;
  allLayouts(): string[];
  layoutAdded: ISignal<ISpectaLayoutRegistry, string>;
  selectedLayout: { name: string; layout: ISpectaLayout };
  setSelectedLayout(name: string): void;
  selectedLayoutChanged: ISignal<
    ISpectaLayoutRegistry,
    { name: string; layout: ISpectaLayout; oldLayout?: ISpectaLayout }
  >;
}

export interface ITopbarConfig {
  background?: string;
  textColor?: string;
  title?: string;
  icon?: string;
  kernelActivity?: boolean;
  settingsButton?: boolean;
  themeToggle?: boolean;
  layoutToggle?: boolean;
  link?: string;
}

export interface ISpectaAppConfig {
  topBar?: ITopbarConfig;
  defaultLayout?: string;
  hideTopbar?: boolean;
  slidesTheme?: string;
  loadingName?: string;
  executionDelay?: number;
  uiSwitcherOptions?: IUiOption[];
  enableStaticRendering?: boolean;
  labConfig?: {
    setSingleMode?: boolean;
    hideLeftPanel?: boolean;
    hideRightPanel?: boolean;
    hideStatusbar?: boolean;
    hideHeader?: boolean;
  };
}

export interface ISpectaCellConfig {
  showSource?: boolean;
  showOutput?: boolean;
  outputSize?: 'Small' | 'Big' | 'Full';
}
export interface IUiOption {
  id: string;
  label: string;
}
export type ISpectaUrlFactory = (path: string, ui?: string) => string;
export interface ISpectaUiSwitcher {
  uis: IUiOption[];
  switchTo: (path: string, ui: string) => void;
  label?: string;
}
export const ISpectaLayoutRegistry = new Token<ISpectaLayoutRegistry>(
  'specta:ISpectaLayoutRegistry'
);

export const ISpectaDocTracker = new Token<IWidgetTracker<Widget>>(
  'exampleDocTracker'
);

export const ISpectaUrlFactoryToken = new Token<ISpectaUrlFactory>(
  'specta:ISpectaUrlFactoryToken'
);
export const ISpectaUiSwitcherToken = new Token<ISpectaUiSwitcher>(
  'specta:ISpectaUiSwitcherToken'
);

export interface ISpectaWidget {
  readonly node: HTMLElement;
  readonly isAttached: boolean;
}

/**
 * The state of the render cache stored in the notebook metadata relative to
 * the notebook itself.
 */
export type ISpectaSnapshotStatus = 'out-of-sync' | 'in-sync' | 'not-exist';

export interface IAppModel extends IDisposable {
  /**
   * The rendermime registry the preview renders outputs with.
   */
  readonly rendermime: IRenderMimeRegistry;

  /**
   * The cells of the sandbox notebook, if it has been created.
   */
  readonly cells: CellList | undefined;

  /**
   * The sandbox context the preview renders from — a throwaway clone whose
   * `save()` is a no-op, not the document context written to disk.
   */
  readonly sandboxContext:
    DocumentRegistry.IContext<INotebookModel> | undefined;

  /**
   * The notebook panel backing the sandbox context.
   */
  readonly panel: NotebookPanel | undefined;

  /**
   * Whether the model renders from the cached snapshot instead of a kernel.
   */
  readonly staticRender: boolean;

  /**
   * Whether static rendering is enabled for this notebook.
   */
  readonly enableStaticRendering: boolean;

  /**
   * A signal emitted with the re-seeded cells when the document changes.
   */
  readonly fileChanged: ISignal<IAppModel, CellList>;

  /**
   * A signal emitted when the render cache or static render mode changes.
   */
  readonly snapshotChanged: ISignal<IAppModel, void>;

  /**
   * Create the sandbox context and notebook panel.
   */
  initialize(): Promise<void>;

  /**
   * Create the output widget for a cell.
   */
  createCell(cellModel: ICellModel): SpectaCellOutput;

  /**
   * Leave static render mode and re-initialize against a live kernel.
   */
  turnOffStaticRender(): Promise<void>;

  /**
   * Bring the sandbox in line with the document, if it has drifted.
   *
   * Returns the re-seeded cell list, or `undefined` when the sandbox already
   * matches.
   */
  resyncSandbox(): CellList | undefined;

  /**
   * Execute a code cell into the given output wrapper.
   */
  executeCell(cell: ICellModel, outputWrapper: SpectaCellOutput): Promise<any>;

  /**
   * The render cache stored in the notebook metadata, if any.
   */
  getSnapshot(): ISpectaSnapshotData | undefined;

  /**
   * Whether the render cache matches the current notebook sources.
   */
  snapshotStatus(): ISpectaSnapshotStatus;

  /**
   * Write a render cache to the notebook metadata and save the document.
   */
  saveSnapshotToMetadata(snapshot: ISpectaSnapshotData): Promise<void>;

  /**
   * Remove the render cache from the notebook metadata, disable static
   * rendering, and save the document.
   */
  deleteSnapshot(): Promise<void>;

  /**
   * Save static rendering preference to the notebook metadata
   */
  setEnableStaticRendering(value: boolean): Promise<void>;
}

export interface IAppWidget extends Widget {
  /**
   * A promise that is fulfilled when the model is ready.
   */
  readonly ready: Promise<void>;

  /**
   * The model driving this widget.
   */
  readonly model: IAppModel;

  /**
   * Add the loading spinner.
   */
  addSpinner(): void;

  /**
   * Remove the loading spinner.
   */
  removeSpinner(): void;

  /**
   * Create and start executing the output widgets for the given cells.
   */
  generateOutputs(cellList?: CellList): Promise<SpectaCellOutput[]>;

  /**
   * The layout this widget renders with.
   */
  getLayout(): ISpectaLayout;

  /**
   * Render the notebook into the host panel.
   */
  render(): Promise<void>;

  /**
   * Discard the current outputs and render again.
   */
  rerender(newCells?: CellList): Promise<void>;

  /**
   * Leave static render mode and render against a live kernel.
   */
  turnOffStaticRender(): Promise<void>;

  /**
   * Capture the current outputs into the render cache.
   *
   * Returns the snapshot timestamp, or `undefined` if nothing was saved.
   */
  saveSnapshot(): Promise<number | undefined>;
}

export interface ISpectaTopbarWidget {
  addTopbarWidget?: (
    widget: ISpectaWidget,
    side: 'left' | 'right',
    rank: number
  ) => void;
  addReactWidget?: (
    widget: JSX.Element,
    side: 'left' | 'right',
    rank: number
  ) => Widget;
  addSettingsWidget?: (widget: ISpectaWidget) => void;
  settingsWidgets?: ISpectaWidget[];
  setSettingsIcon?: (icon: JSX.Element) => void;
  settingsIconChanged?: ISignal<any, JSX.Element>;
  customIcon?: JSX.Element;
}
export const ISpectaTopbarWidgetToken = new Token<ISpectaTopbarWidget>(
  'specta:ISpectaTopbarWidget'
);
