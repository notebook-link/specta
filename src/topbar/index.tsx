import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import * as React from 'react';

import {
  ISpectaLayoutRegistry,
  ISpectaShell,
  ISpectaTopbarWidget,
  ISpectaTopbarWidgetToken
} from '../token';
import { isSpectaApp, readSpectaConfig } from '../tool';
import { MenuComponent } from './menuComponent';
import { TitleComponent } from './titleComponent';
import { TopbarWidget } from './topbarWidget';

export const topbarPlugin: JupyterFrontEndPlugin<
  ISpectaTopbarWidget,
  ISpectaShell
> = {
  id: 'specta:topbar',
  description: 'Specta topbar extension',
  autoStart: true,
  requires: [IThemeManager, ISpectaLayoutRegistry],
  provides: ISpectaTopbarWidgetToken,
  activate: (
    app: JupyterFrontEnd<ISpectaShell>,
    themeManager: IThemeManager,
    layoutRegistry: ISpectaLayoutRegistry
  ) => {
    const isSpecta = isSpectaApp();
    if (!isSpecta) {
      return { addTopbarWidget: undefined };
    }
    const urlParams = new URLSearchParams(window.location.search);
    const path = urlParams.get('path');

    const config = readSpectaConfig({ nbPath: path });
    if (config.hideTopbar) {
      app.shell.hideTopBar();
      return { addTopbarWidget: undefined };
    }

    const widget = new TopbarWidget({
      config: config.topBar
    });

    widget.id = 'specta-topbar-widget';
    app.shell.add(widget, 'top');

    if (path && PathExt.extname(path) === '.ipynb') {
      // Specta document will handle the top bar.
      return widget;
    }
    const title = <TitleComponent config={config.topBar} />;
    widget.addReactWidget(title, 'left', 0);
    const menu = (
      <MenuComponent
        config={config.topBar}
        themeManager={themeManager}
        layoutRegistry={layoutRegistry}
      />
    );
    widget.addReactWidget(menu, 'right', 10000);

    return widget;
  }
};
