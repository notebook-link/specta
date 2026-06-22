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
import { PageConfig, URLExt } from '@jupyterlab/coreutils';
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
  ISpectaUiSwitcher,
  ISpectaUiSwitcherToken,
  ISpectaUrlFactory,
  ISpectaUrlFactoryToken
} from '../token';
import {
  createFileBrowser,
  hideAppLoadingIndicator,
  isSpectaApp,
  registerDocumentFactory,
  getSpectaDocInfo,
  openDocument

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
  kernelSpecManager: KernelSpec.IManager,
  uiSwitcher: ISpectaUiSwitcher | null
): IWidgetTracker => {
  console.log('Specta document tracker active!'); // Test log here
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
    kernelSpecManager,
    uiSwitcher
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
  optional: [ISpectaUiSwitcherToken],
  activate,
  provides: ISpectaDocTracker
};

export const spectaUrlFactory: JupyterFrontEndPlugin<ISpectaUrlFactory> = {
  id: 'specta/application-extension:urlFactory',
  autoStart: true,
  provides: ISpectaUrlFactoryToken,
  activate: () => {
    const segments: Record<string, string> = {
      lab: 'lab',
      specta: 'specta'
    };
    return (path: string, ui = 'specta'): string => {
      const baseUrl = PageConfig.getBaseUrl();
      const segment = segments[ui] ?? ui;
      const url = new URL(URLExt.join(baseUrl, segment, 'index.html'));
      // spectaOpener in lab mode reads 'specta-path'; specta app reads 'path'
      url.searchParams.set(ui === 'lab' ? 'specta-path' : 'path', path);
      const queries = PageConfig.getOption('query').split('&').filter(Boolean);
      queries.forEach(query => {
        const [key, value] = query.split('=');
        url.searchParams.set(key, value);
      });
      return url.toString();
    };
  }
};

export const spectaUiSwitcher: JupyterFrontEndPlugin<ISpectaUiSwitcher> = {
  id: 'specta/application-extension:uiSwitcher',
  autoStart: true,
  requires: [ISpectaUrlFactoryToken],
  provides: ISpectaUiSwitcherToken,
  activate: (_app, urlFactory: ISpectaUrlFactory) => {
    return {
      uis: [
        { id: 'lab', label: 'JupyterLab' },
        { id: 'specta', label: 'Specta' }
      ],
      switchTo: (path: string, ui: string) => {
        window.location.assign(urlFactory(path, ui));
      }
    };
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
        const { isSpectaDoc, factory } = getSpectaDocInfo(path, app);
        if (isSpectaDoc) {
          openDocument(path, factory, docManager, app.shell);
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
          const { isSpectaDoc, factory } = getSpectaDocInfo(path, app);

          if (isSpectaDoc) {
            app.shell.addClass('specta-document-viewer');
            openDocument(path, factory, docManager, app.shell);
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
