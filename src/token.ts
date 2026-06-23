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
  uis?: IUiOption[];
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

export interface ISpectaTopbarWidget {
  addTopbarWidget?: (
    widget: Widget,
    side: 'left' | 'right',
    rank: number
  ) => void;
  addReactWidget?: (
    widget: JSX.Element,
    side: 'left' | 'right',
    rank: number
  ) => void;
}
export const ISpectaTopbarWidgetToken = new Token<ISpectaTopbarWidget>(
  'specta:ISpectaTopbarWidget'
);
