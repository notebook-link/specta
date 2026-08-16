import { type INotebookContent } from '@jupyterlab/nbformat';
export const WIDGET_STATE_MIMETYPE =
  'application/vnd.jupyter.widget-state+json';
export const WIDGET_VIEW_MIMETYPE = 'application/vnd.jupyter.widget-view+json';

export const SPECTA_SNAPSHOT_KEY = 'spectaSnapshot';

export interface IWidgetManagerState {
  version_major: number;
  version_minor: number;
  state: { [modelId: string]: unknown };
}

export interface IWidgetManagerLike {
  get_state(options?: {
    drop_defaults?: boolean;
  }): Promise<IWidgetManagerState>;
}

export interface ISpectaSnapshotData {
  timestamp: number;
  hash: string;
  notebook?: INotebookContent;
  widgetStates: IWidgetManagerState | null;
}

export type INotebookContentWithSnapshot = INotebookContent & {
  metadata: INotebookContent['metadata'] & {
    [SPECTA_SNAPSHOT_KEY]: ISpectaSnapshotData | undefined;
  };
};
