import { ReactWidget } from '@jupyterlab/apputils';
import { Panel, Widget } from '@lumino/widgets';

import { ITopbarConfig, ISpectaWidget } from '../token';
import { RankedPanel } from './rankedPanel';

export class TopbarWidget extends Panel {
  constructor(options: TopbarWidget.IOptions) {
    super(options);
    this._config = {
      background: options.config?.background ?? 'var(--jp-layout-color1)',
      title: options.config?.title ?? 'Specta',
      themeToggle: Boolean(options.config?.themeToggle),
      kernelActivity: Boolean(options.config?.kernelActivity),
      textColor: options.config?.textColor ?? 'var(--jp-ui-font-color1)',
      icon: options.config?.icon
    };
    this.addClass('specta-topbar');
    this.addClass('specta-topbar-element');
    this.node.style.background =
      this._config.background ?? 'var(--jp-layout-color1)';

    this._rightSide.addClass('specta-topbar-right');
    this._leftSide.addClass('specta-topbar-left');
    this.addWidget(this._leftSide);
    this.addWidget(this._rightSide);
  }

  addReactWidget(el: JSX.Element, side: 'left' | 'right', rank: number): Widget {
    const widget = ReactWidget.create(el);
    this.addTopbarWidget(widget, side, rank);
    return widget;
  }
  addTopbarWidget(widget: ISpectaWidget, side: 'left' | 'right', rank: number): void {
    if (side === 'left') {
      this._leftSide.addWidget(widget as Widget, rank);
    } else {
      this._rightSide.addWidget(widget as Widget, rank);
    }
  }

  addSettingsWidget(widget: ISpectaWidget): void {
    this._settingsWidgets.push(widget);
  }

  get settingsWidgets(): ISpectaWidget[] {
    return this._settingsWidgets;
  }

  private _leftSide = new RankedPanel();
  private _rightSide = new RankedPanel();
  private _settingsWidgets: ISpectaWidget[] = [];

  private _config: ITopbarConfig;
}

export namespace TopbarWidget {
  export interface IOptions extends Panel.IOptions {
    config?: ITopbarConfig;
  }
}
