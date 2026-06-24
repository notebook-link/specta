import { IThemeManager } from '@jupyterlab/apputils';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook';
import { Panel } from '@lumino/widgets';
import * as React from 'react';

import { SpectaWidgetFactory } from '../specta_widget_factory';
import {
  ISpectaLayoutRegistry,
  ISpectaShell,
  ISpectaTopbarWidget
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
        let topbarWidget: ISpectaTopbarWidget | undefined = undefined;
        let localTopbar: TopbarWidget | undefined = undefined;

        if (!isSpecta) {
          localTopbar = new TopbarWidget({
            config: spectaConfig.topBar
          });
          topbarWidget = localTopbar;
        } else {
          topbarWidget = this._spectaTopbar;
        }

        const menu = (
          <MenuComponent
            config={spectaConfig.topBar}
            themeManager={this._themeManager}
            settingsWidgets={topbarWidget?.settingsWidgets}
          />
        );

        if (!isSpecta && localTopbar) {
          const titleWidget = localTopbar.addReactWidget(title, 'left', 0);
          if (titleWidget) {
            titleWidget.addClass('specta-topbar-title-wrapper');
          }
          localTopbar.addReactWidget(menu, 'right', 10000);
          content.addWidget(localTopbar);
        } else {
          if (this._spectaTopbar.addReactWidget) {
            const titleWidget = this._spectaTopbar.addReactWidget(title, 'left', 0);
            if (titleWidget) {
              titleWidget.addClass('specta-topbar-title-wrapper');
            }
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
}
