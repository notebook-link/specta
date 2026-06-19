import { IThemeManager } from '@jupyterlab/apputils';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook';
import { Panel } from '@lumino/widgets';
import * as React from 'react';

import { SpectaWidgetFactory } from '../specta_widget_factory';
import {
  ISpectaLayoutRegistry,
  ISpectaShell,
  ISpectaTopbarWidget,
  ISpectaUrlFactory
} from '../token';
import { isSpectaApp, readSpectaConfig } from '../tool';
import { MenuComponent } from '../topbar/menuComponent';
import { TitleComponent } from '../topbar/titleComponent';
import { TopbarWidget } from '../topbar/topbarWidget';
import { NotebookSpectaDocWidget } from './widget';

interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
  spectaWidgetFactory: SpectaWidgetFactory;
  layoutRegistry?: ISpectaLayoutRegistry;
  themeManager?: IThemeManager;
  shell: ISpectaShell;
  spectaLayoutRegistry: ISpectaLayoutRegistry;
  spectaTopbar: ISpectaTopbarWidget;
  urlFactory?: ISpectaUrlFactory | null;
}

export class NotebookGridWidgetFactory extends ABCWidgetFactory<
  NotebookSpectaDocWidget,
  INotebookModel
> {
  constructor(options: IOptions) {
    super(options);
    this._spectaWidgetFactory = options.spectaWidgetFactory;
    this._shell = options.shell;
    this._themeManager = options.themeManager;
    this._spectaTopbar = options.spectaTopbar;
    this._urlFactory = options.urlFactory;
  }

  protected createNewWidget(
    context: DocumentRegistry.IContext<INotebookModel>
  ): NotebookSpectaDocWidget {
    const content = new Panel();
    content.addClass('jp-specta-notebook-panel');

    context.ready.then(async () => {
      const path = context.contentsModel?.path;
      const spectaConfig = readSpectaConfig({
        nbMetadata: context.model.metadata,
        nbPath: path
      });
      const isSpecta = isSpectaApp();
      if (!spectaConfig.hideTopbar) {
        const title = <TitleComponent config={spectaConfig.topBar} />;
        const menu = (
          <MenuComponent
            config={spectaConfig.topBar}
            themeManager={this._themeManager}
            urlFactory={this._urlFactory}
            currentPath={path}
            currentUi={isSpecta ? 'specta' : 'lab'}
          />
        );
        if (!isSpecta) {
          // Not a specta app, add topbar to document widget
          const topbar = new TopbarWidget({
            config: spectaConfig.topBar
          });
          topbar.addReactWidget(title, 'left', 0);
          topbar.addReactWidget(menu, 'right', 10000);
          content.addWidget(topbar);
        } else {
          if (this._spectaTopbar.addReactWidget) {
            this._spectaTopbar.addReactWidget(title, 'left', 0);
            this._spectaTopbar.addReactWidget(menu, 'right', 10000);
          }
        }
      } else if (isSpecta) {
        this._shell.hideTopBar();
      }

      const spectaWidget = await this._spectaWidgetFactory.createNew({
        context
      });

      if (spectaWidget) {
        content.addWidget(spectaWidget);
      }
    });

    const widget = new NotebookSpectaDocWidget({
      context,
      content
    });

    return widget;
  }

  private _spectaWidgetFactory: SpectaWidgetFactory;
  private _shell: ISpectaShell;
  private _themeManager?: IThemeManager;
  private _spectaTopbar: ISpectaTopbarWidget;
  private _urlFactory?: ISpectaUrlFactory | null;
}
