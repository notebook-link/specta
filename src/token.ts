import { Token } from '@lumino/coreutils';
import { Panel, Widget } from '@lumino/widgets';
import { SpectaCellOutput } from './specta_cell_output';
import * as nbformat from '@jupyterlab/nbformat';
import { ISignal } from '@lumino/signaling';
import { IWidgetTracker } from '@jupyterlab/apputils';
import { JupyterFrontEnd } from '@jupyterlab/application';

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
export type ISpectaUrlFactory = (path: string) => string;
export const ISpectaLayoutRegistry = new Token<ISpectaLayoutRegistry>(
  'specta:ISpectaLayoutRegistry'
);

export const ISpectaDocTracker = new Token<IWidgetTracker<Widget>>(
  'exampleDocTracker'
);

export const ISpectaUrlFactoryToken = new Token<ISpectaUrlFactory>(
  'specta:ISpectaUrlFactoryToken'
);

export interface ISpectaWidget {
  readonly node: HTMLElement;
  readonly isAttached: boolean;
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
}
export const ISpectaTopbarWidgetToken = new Token<ISpectaTopbarWidget>(
  'specta:ISpectaTopbarWidget'
);
