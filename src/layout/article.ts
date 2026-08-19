import { Panel, Widget } from '@lumino/widgets';
import type { SpectaCellOutput } from '../specta_cell_output';
import { INotebookContent } from '@jupyterlab/nbformat';
import { ISpectaLayout } from '../token';

class HostPanel extends Panel {
  constructor() {
    super();
    this.addClass('specta-article-host-widget');
    this._outputs = new Panel();
    this._outputs.addClass('specta-article-outputs-panel');
    this.addWidget(this._outputs);
  }

  addOutput(widget: Widget): void {
    this._outputs.addWidget(widget);
  }
  private _outputs: Panel;
}
export class ArticleLayout implements ISpectaLayout {
  async render(options: {
    host: Panel;
    items: SpectaCellOutput[];
    notebook: INotebookContent;
    readyCallback: () => Promise<void>;
  }): Promise<void> {
    const { host, items, readyCallback } = options;
    const hostPanel = new HostPanel();
    for (const el of items) {
      const cellModel = el.info.cellModel;
      const info = el.info;
      if (cellModel?.cell_type === 'code') {
        if (!info.hidden) {
          hostPanel.addOutput(el);
        }
      } else {
        if (!info.hidden) {
          hostPanel.addOutput(el);
        }
      }
    }

    host.addWidget(hostPanel);
    await readyCallback();
  }
}
