import { type INotebookContent } from '@jupyterlab/nbformat';

export const WIDGET_STATE_MIMETYPE =
  'application/vnd.jupyter.widget-state+json';
export const WIDGET_VIEW_MIMETYPE = 'application/vnd.jupyter.widget-view+json';

export const SPECTA_SNAPSHOT_KEY = 'spectaSnapshot';

/**
 * Format version of the snapshot persisted in notebook metadata.
 *
 * Bump this whenever `ISpectaSnapshotData` changes shape. Snapshots carrying
 * any other version are rejected by `parseSnapshot`, so a notebook written by
 * a different Specta falls back to rendering with a kernel rather than being
 * read as the wrong format.
 */
export const SPECTA_SNAPSHOT_VERSION = 1;

export interface IWidgetManagerState {
  version_major: number;
  version_minor: number;
  state: { [modelId: string]: unknown };
}

export interface ISpectaSnapshotData {
  version: number;
  timestamp: number;
  hash: string;
  notebook: INotebookContent;
  widgetStates: IWidgetManagerState | null;
}

export type INotebookContentWithSnapshot = INotebookContent & {
  metadata: INotebookContent['metadata'] & {
    [SPECTA_SNAPSHOT_KEY]: ISpectaSnapshotData | undefined;
  };
};

/**
 * Read a snapshot out of raw notebook metadata.
 *
 * This is the only place that knows the persisted shape. Anything unusable —
 * absent, malformed, unversioned, or written by a newer Specta — yields
 * `undefined` so the caller can fall back to rendering with a kernel.
 */
export function parseSnapshot(raw: unknown): ISpectaSnapshotData | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const data = raw as Partial<ISpectaSnapshotData>;
  if (data.version === undefined || data.version > SPECTA_SNAPSHOT_VERSION) {
    console.warn(
      `Specta: ignoring snapshot of version ${String(data.version)}, ` +
        `expected ${SPECTA_SNAPSHOT_VERSION}.`
    );
    return undefined;
  }
  if (typeof data.hash !== 'string' || typeof data.timestamp !== 'number') {
    return undefined;
  }
  if (!data.notebook || !Array.isArray(data.notebook.cells)) {
    return undefined;
  }
  return {
    version: data.version,
    timestamp: data.timestamp,
    hash: data.hash,
    notebook: data.notebook,
    widgetStates: data.widgetStates ?? null
  };
}
