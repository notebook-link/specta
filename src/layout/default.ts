import { Panel } from '@lumino/widgets';
import type { SpectaCellOutput } from '../specta_cell_output';
import { INotebookContent } from '@jupyterlab/nbformat';
import { ISpectaLayout } from '../token';

export class DashboardLayout implements ISpectaLayout {
  async render(options: {
    host: Panel;
    items: SpectaCellOutput[];
    notebook: INotebookContent;
    readyCallback: () => Promise<void>;
  }): Promise<void> {
    const { host, items, readyCallback } = options;
    for (const el of items) {
      const cellModel = el.info.cellModel;
      const info = el.info;
      if (cellModel?.cell_type === 'code') {
        if (!info.hidden) {
          host.addWidget(el);
        }
      } else {
        if (!info.hidden) {
          host.addWidget(el);
        }
      }
    }
    await readyCallback();
  }
}
