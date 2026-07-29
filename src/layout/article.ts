import { Panel, Widget } from '@lumino/widgets';
import { SpectaCellOutput } from '../specta_cell_output';
import * as nbformat from '@jupyterlab/nbformat';
import { ISpectaAppConfig, ISpectaLayout } from '../token';

class HostPanel extends Panel {
  constructor(showBorders?: boolean) {
    super();
    this.addClass('specta-article-host-widget');
    if (showBorders) {
      this.addClass('specta-show-borders');
    }
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
    notebook: nbformat.INotebookContent;
    readyCallback: () => Promise<void>;
    spectaConfig?: ISpectaAppConfig;
  }): Promise<void> {
    const { host, items, readyCallback, spectaConfig } = options;
    const hostPanel = new HostPanel(spectaConfig?.showBorders);
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
