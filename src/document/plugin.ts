import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IThemeManager,
  IWidgetTracker,
  WidgetTracker
} from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { PageConfig, PathExt, URLExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { IKernelSpecManager, KernelSpec } from '@jupyterlab/services';
import { Widget } from '@lumino/widgets';

import {
  ISpectaDocTracker,
  ISpectaLayoutRegistry,
  ISpectaShell,
  ISpectaTopbarWidget,
  ISpectaTopbarWidgetToken,
  ISpectaUrlFactory,
  ISpectaUrlFactoryToken
} from '../token';
import {
  configLabLayout,
  createFileBrowser,
  hideAppLoadingIndicator,
  isSpectaApp,
  readSpectaConfig,
  registerDocumentFactory,
  PLAINB_PREFIX
} from '../tool';

const activate = (
  app: JupyterFrontEnd<ISpectaShell>,
  rendermime: IRenderMimeRegistry,
  tracker: INotebookTracker,
  editorServices: IEditorServices,
  contentFactory: NotebookPanel.IContentFactory,
  spectaLayoutRegistry: ISpectaLayoutRegistry,
  themeManager: IThemeManager,
  spectaTopbar: ISpectaTopbarWidget,
  kernelSpecManager: KernelSpec.IManager
): IWidgetTracker => {
  const namespace = 'specta';
  const spectaTracker = new WidgetTracker<Widget>({ namespace });

  registerDocumentFactory({
    factoryName: 'specta',
    app,
    rendermime,
    tracker,
    editorServices,
    contentFactory,
    spectaTracker,
    spectaLayoutRegistry,
    themeManager,
    spectaTopbar,
    kernelSpecManager
  });

  return spectaTracker;
};

export const spectaDocument: JupyterFrontEndPlugin<
  IWidgetTracker,
  ISpectaShell
> = {
  id: 'specta:notebook-doc',
  autoStart: true,
  requires: [
    IRenderMimeRegistry,
    INotebookTracker,
    IEditorServices,
    NotebookPanel.IContentFactory,
    ISpectaLayoutRegistry,
    IThemeManager,
    ISpectaTopbarWidgetToken,
    IKernelSpecManager
  ],
  activate,
  provides: ISpectaDocTracker
};

export const spectaUrlFactory: JupyterFrontEndPlugin<ISpectaUrlFactory> = {
  id: 'specta/application-extension:urlFactory',
  autoStart: true,
  provides: ISpectaUrlFactoryToken,
  activate: () => {
    const urlFactory = (path: string) => {
      const baseUrl = PageConfig.getBaseUrl();
      let appUrl = PageConfig.getOption('appUrl');
      if (!appUrl.endsWith('/')) {
        appUrl = `${appUrl}/`;
      }
      const url = new URL(URLExt.join(baseUrl, appUrl));
      url.searchParams.set('path', path);
      const queries = PageConfig.getOption('query').split('&').filter(Boolean);
      queries.forEach(query => {
        const [key, value] = query.split('=');
        url.searchParams.set(key, value);
      });
      return url.toString();
    };
    return urlFactory;
  }
};

export const spectaOpener: JupyterFrontEndPlugin<void, ILabShell> = {
  id: 'specta/application-extension:opener',
  autoStart: true,
  requires: [
    IDocumentManager,
    IDefaultFileBrowser,
    ISpectaDocTracker,
    IKernelSpecManager
  ],
  optional: [ISpectaUrlFactoryToken],
  activate: async (
    app: JupyterFrontEnd<ILabShell>,
    docManager: IDocumentManager,
    defaultBrowser: IDefaultFileBrowser,
    tracker: IWidgetTracker,
    kernelSpecManager: KernelSpec.IManager,
    urlFactory: ISpectaUrlFactory | null
  ): Promise<void> => {
    const urlParams = new URLSearchParams(window.location.search);
    const noTree = urlParams.get('no-tree') === 'true';
    if (!isSpectaApp()) {
      // Not a specta app
      const path = urlParams.get('specta-path');

      if (!path) {
        return;
      }
      app.restored.then(async () => {
        const labShell = app.shell;

        const fileTypes = app.docRegistry.getFileTypesForPath(path);
        const plainbFileType = fileTypes.find(ft =>
          ft.name.startsWith(PLAINB_PREFIX)
        );
        const isPlainb = !!plainbFileType;
        const fileTypeName = plainbFileType
          ? plainbFileType.name
          : fileTypes[0]?.name;

        if (PathExt.extname(path) === '.ipynb' || isPlainb) {
          const commands = app.commands;
          const spectaConfig = readSpectaConfig({});
          await configLabLayout({
            config: spectaConfig.labConfig,
            labShell,
            commands
          });
          let factory = 'specta';
          if (isPlainb) {
            factory = fileTypeName.replace(PLAINB_PREFIX, 'specta-');
          }
          const widget = docManager.openOrReveal(path, factory);
          if (widget) {
            app.shell.add(widget, 'main');
          }
        }
      });
      return;
    } else {
      //  Specta app
      const path = urlParams.get('path');
      if (!path) {
        if (!noTree) {
          const browser = createFileBrowser({ defaultBrowser, urlFactory });
          app.shell.add(browser, 'main', { rank: 100 });
        }
        hideAppLoadingIndicator();
      } else {
        app.restored.then(async () => {
          await new Promise(r => setTimeout(r, 100));
          await kernelSpecManager.ready;
          const fileTypes = app.docRegistry.getFileTypesForPath(path);
          const plainbFileType = fileTypes.find(ft =>
            ft.name.startsWith(PLAINB_PREFIX)
          );
          const isPlainb = !!plainbFileType;
          const fileTypeName = plainbFileType
            ? plainbFileType.name
            : fileTypes[0]?.name;

          if (PathExt.extname(path) === '.ipynb' || isPlainb) {
            app.shell.addClass('specta-document-viewer');
            let factory = 'specta';
            if (isPlainb) {
              factory = fileTypeName.replace(PLAINB_PREFIX, 'specta-');
            }
            const widget = docManager.openOrReveal(path, factory);
            if (widget) {
              app.shell.add(widget, 'main');
            }
          } else {
            let count = 0;
            const tryOpen = () => {
              const widget = docManager.openOrReveal(path, 'default');
              if (widget) {
                app.shell.add(widget, 'main');
                hideAppLoadingIndicator();
              } else {
                count++;
                if (count > 10) {
                  console.error('Failed to open file', path);
                  const widget = new Widget();
                  widget.node.innerHTML = `<h2 style="text-align: center; margin-top: 200px;">Failed to open file ${path}</h2>`;
                  app.shell.add(widget, 'main');
                  hideAppLoadingIndicator();
                  return;
                }
                setTimeout(tryOpen, 100);
              }
            };
            tryOpen();
          }
        });
      }
    }
  }
};
