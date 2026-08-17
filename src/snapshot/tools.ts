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

export interface IWidgetManagerLike {
  get_state(options?: {
    drop_defaults?: boolean;
  }): Promise<IWidgetManagerState>;
}

export interface ISpectaSnapshotData {
  version: number;
  timestamp: number;
  hash: string;
  notebook: INotebookContent;
  widgetStates: IWidgetManagerState | null;
}

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

export type INotebookContentWithSnapshot = INotebookContent & {
  metadata: INotebookContent['metadata'] & {
    [SPECTA_SNAPSHOT_KEY]: ISpectaSnapshotData | undefined;
  };
};
export function computeHash(str: string): string {
  const s = str.replace(/\s+/g, ' ').trim();
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

export function snapshotHash(sources: Array<string | string[]>): string {
  return computeHash(
    sources.map(s => (Array.isArray(s) ? s.join('') : s)).join('\n')
  );
}
