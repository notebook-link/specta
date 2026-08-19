import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookContent } from '@jupyterlab/nbformat';
import { IOutput } from '@jupyterlab/nbformat';
import { INotebookModel } from '@jupyterlab/notebook';
import { SimplifiedOutputArea } from '@jupyterlab/outputarea';
import { Widget } from '@lumino/widgets';

import type { SpectaCellOutput } from '../specta_cell_output';
import {
  ISpectaSnapshotData,
  IWidgetManagerState,
  SPECTA_SNAPSHOT_VERSION,
  WIDGET_VIEW_MIMETYPE
} from './format';
import { snapshotHash } from './hash';

/**
 * The part of the ipywidgets manager we need: its serialized model state.
 */
interface IWidgetManagerLike {
  get_state(options?: {
    drop_defaults?: boolean;
  }): Promise<IWidgetManagerState>;
}

/**
 * Harvest the ipywidgets model state backing an output area, so widget views
 * can be rebuilt later without a kernel.
 * One manager serves the whole notebook, so the first one found answers for
 * every widget. Returns `null` if the area renders no widget views.
 */
export async function collectWidgetState(
  area: SimplifiedOutputArea,
  outputs: IOutput[]
): Promise<IWidgetManagerState | null> {
  for (let index = 0; index < outputs.length; index++) {
    const data = (outputs[index]?.data as Record<string, unknown>) ?? {};
    const viewSpec = data[WIDGET_VIEW_MIMETYPE] as
      { model_id?: string } | undefined;
    if (!viewSpec?.model_id) {
      continue;
    }

    const outputWidget = area.widgets[index];
    if (!outputWidget) {
      continue;
    }
    for (const child of outputWidget.children()) {
      const renderer = child as Widget & {
        mimeType?: string;
        _manager?: { promise: Promise<IWidgetManagerLike> };
      };
      if (renderer.mimeType !== WIDGET_VIEW_MIMETYPE || !renderer._manager) {
        continue;
      }
      try {
        const manager = await renderer._manager.promise;
        return await manager.get_state();
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

/**
 * Build a snapshot from the sandbox notebook and the outputs currently on
 * screen.
 */
export async function captureSnapshot(options: {
  sandbox: DocumentRegistry.IContext<INotebookModel>;
  outputs: SpectaCellOutput[];
}): Promise<ISpectaSnapshotData> {
  const { sandbox, outputs } = options;
  const notebook = sandbox.model.toJSON() as INotebookContent;

  const snapshot: ISpectaSnapshotData = {
    version: SPECTA_SNAPSHOT_VERSION,
    hash: snapshotHash(notebook.cells.map(cell => cell.source)),
    timestamp: Date.now(),
    notebook,
    widgetStates: null
  };

  for (const el of outputs) {
    if (
      el.info.hidden ||
      el.info.cellModel?.cell_type !== 'code' ||
      el.info.cellIndex === undefined
    ) {
      continue;
    }
    const target = notebook.cells[el.info.cellIndex];
    if (!target) {
      continue;
    }

    const area = el.cellOutput as SimplifiedOutputArea;
    const outputModels = area.model.toJSON();
    target.outputs = outputModels;

    if (!snapshot.widgetStates) {
      snapshot.widgetStates = await collectWidgetState(area, outputModels);
    }
  }

  return snapshot;
}
