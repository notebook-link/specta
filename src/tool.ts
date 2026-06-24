import { ILabShell, JupyterFrontEnd } from '@jupyterlab/application';
import { IThemeManager, WidgetTracker } from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { PageConfig, PathExt, URLExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ICell, INotebookMetadata } from '@jupyterlab/nbformat';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents, KernelSpec } from '@jupyterlab/services';
import { CommandRegistry } from '@lumino/commands';

import { NotebookGridWidgetFactory } from './document/factory';
import { PlainbNotebookModelFactory } from './document/plainb_factory';
import { SpectaWidgetFactory } from './specta_widget_factory';
import {
  ISpectaAppConfig,
  ISpectaCellConfig,
  ISpectaLayoutRegistry,
  ISpectaShell,
  ISpectaTopbarWidget,
  ISpectaUiSwitcher,
  ISpectaUrlFactory
} from './token';

export const PLAINB_PREFIX = 'ptjnb-';

// Plain-text notebook formats handled via plainb.
export const PLAINB_EXTENSIONS: Array<{
  ext: string;
  fileTypeName: string;
  modelName: string;
  factoryName: string;
}> = [
  {
    ext: '.py',
    fileTypeName: `${PLAINB_PREFIX}py`,
    modelName: `${PLAINB_PREFIX}model-py`,
    factoryName: 'specta-py'
  },
  {
    ext: '.md',
    fileTypeName: `${PLAINB_PREFIX}md`,
    modelName: `${PLAINB_PREFIX}model-md`,
    factoryName: 'specta-md'
  }
];

export function registerDocumentFactory(options: {
  factoryName: string;
  app: JupyterFrontEnd<ISpectaShell>;
  rendermime: IRenderMimeRegistry;
  tracker: INotebookTracker;
  editorServices: IEditorServices;
  contentFactory: NotebookPanel.IContentFactory;
  spectaTracker: WidgetTracker;
  spectaLayoutRegistry: ISpectaLayoutRegistry;
  themeManager?: IThemeManager;
  spectaTopbar: ISpectaTopbarWidget;
  kernelSpecManager: KernelSpec.IManager;
  uiSwitcher?: ISpectaUiSwitcher | null;
}) {
  const {
    factoryName,
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
  } = options;

  const spectaWidgetFactory = new SpectaWidgetFactory({
    manager: app.serviceManager,
    rendermime,
    tracker,
    contentFactory,
    mimeTypeService: editorServices.mimeTypeService,
    editorServices,
    spectaLayoutRegistry,
    kernelSpecManager
  });
  const widgetFactory = new NotebookGridWidgetFactory({
    name: factoryName,
    modelName: 'notebook',
    fileTypes: ['notebook'],
    shell: app.shell,
    spectaWidgetFactory,
    themeManager,
    spectaLayoutRegistry,
    spectaTopbar,
    uiSwitcher
  });

  // Registering the widget factory
  app.docRegistry.addWidgetFactory(widgetFactory);

  widgetFactory.widgetCreated.connect((sender, widget) => {
    widget.context.pathChanged.connect(() => {
      spectaTracker.save(widget);
    });
    spectaTracker.add(widget);
  });

  // Register one auto-detecting "Specta" factory per plain-text extension.
  for (const {
    ext,
    fileTypeName,
    modelName,
    factoryName
  } of PLAINB_EXTENSIONS) {
    app.docRegistry.addFileType({
      name: fileTypeName,
      extensions: [ext],
      contentType: 'file',
      fileFormat: 'text'
    });

    app.docRegistry.addModelFactory(
      new PlainbNotebookModelFactory({
        name: modelName,
        ext,
        kernelSpecManager
      })
    );

    const plainbWidgetFactory = new NotebookGridWidgetFactory({
      name: factoryName,
      label: 'Specta',
      modelName: modelName,
      fileTypes: [fileTypeName],
      shell: app.shell,
      spectaWidgetFactory,
      themeManager,
      spectaLayoutRegistry,
      spectaTopbar,
      uiSwitcher
    });

    app.docRegistry.addWidgetFactory(plainbWidgetFactory);

    // Connect the widget to the specta tracker
    plainbWidgetFactory.widgetCreated.connect((_sender, widget) => {
      widget.context.pathChanged.connect(() => {
        spectaTracker.save(widget);
      });
      spectaTracker.add(widget);
    });
  }
}

export function createFileBrowser(options: {
  defaultBrowser: IDefaultFileBrowser;
  urlFactory: ISpectaUrlFactory | null;
}) {
  const { defaultBrowser, urlFactory } = options;
  const browser = defaultBrowser as any;
  browser.singleClickNavigation = true;
  browser.showFileCheckboxes = false;
  browser.showLastModifiedColumn = false;
  browser.addClass('specta-file-browser');

  const urlFactoryFn = urlFactory
    ? urlFactory
    : (path: string) => {
        const baseUrl = PageConfig.getBaseUrl();
        let appUrl = PageConfig.getOption('appUrl');
        if (!appUrl.endsWith('/')) {
          appUrl = `${appUrl}/`;
        }
        const url = new URL(URLExt.join(baseUrl, appUrl));
        url.searchParams.set('path', path);
        const queries = PageConfig.getOption('query')
          .split('&')
          .filter(Boolean);
        queries.forEach(query => {
          const [key, value] = query.split('=');
          url.searchParams.set(key, value);
        });
        return url.toString();
      };

  const oldHandler = browser.listing.handleOpen.bind(browser.listing);
  browser.listing.handleOpen = (item: Contents.IModel) => {
    if (item.type === 'directory') {
      oldHandler(item);
      return;
    } else {
      window.open(urlFactoryFn(item.path), '_blank');
    }
  };

  return browser;
}

export function hideAppLoadingIndicator() {
  const indicator = document.getElementById('specta-loader-host');
  const spinner = document.getElementById('specta-loader-spinner');
  if (indicator && spinner) {
    indicator.style.opacity = '0';
    setTimeout(() => {
      spinner.remove();
      indicator.remove();
      document.body.classList.remove('jp-mod-dark', 'jp-mod-light');
    }, 1000);
  }
}

export function mergeObjects(
  lowerPriority: Record<string, any>,
  higherPriority: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = { ...lowerPriority };

  for (const key of Object.keys(higherPriority)) {
    const highVal = higherPriority[key];
    const lowVal = lowerPriority[key];

    // If higher is null or undefined, keep lower if it exists
    if (highVal === null || highVal === undefined) {
      if (lowVal !== null && lowVal !== undefined) {
        result[key] = lowVal;
      }
      continue;
    }

    // Deep merge plain objects
    if (isPlainObject(lowVal) && isPlainObject(highVal)) {
      result[key] = mergeObjects(lowVal, highVal);
      continue;
    }

    // Otherwise, higher priority wins
    result[key] = highVal;
  }

  return result;
}

function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getSpectaAssetUrl(path: string): string {
  const labExtension = PageConfig.getOption('fullLabextensionsUrl');
  const url = URLExt.join(labExtension, 'jupyter-specta', 'static', path);

  return url;
}

export function isSpectaApp(): boolean {
  return !!document.querySelector('meta[name="specta-config"]');
}

export function readSpectaConfig({
  nbMetadata,
  nbPath
}: {
  nbMetadata?: INotebookMetadata;
  nbPath?: string | null;
}): ISpectaAppConfig {
  let rawConfig = PageConfig.getOption('spectaConfig');
  if (!rawConfig || rawConfig.length === 0) {
    rawConfig = '{}';
  }
  let pathWithoutDrive = nbPath;
  const paths = nbPath?.split(':');
  if (paths && paths.length > 1) {
    pathWithoutDrive = paths[1];
  }
  const { perFileConfig, ...globalConfig } = JSON.parse(rawConfig);

  let spectaConfig: ISpectaAppConfig = { ...(globalConfig ?? {}) };
  let fileConfig: ISpectaAppConfig = {};
  if (perFileConfig && pathWithoutDrive && perFileConfig[pathWithoutDrive]) {
    fileConfig = perFileConfig[pathWithoutDrive];
    spectaConfig = { ...spectaConfig, ...fileConfig };
  }

  const spectaMetadata = JSON.parse(JSON.stringify(nbMetadata?.specta ?? {}));

  if (spectaMetadata.hideTopbar === 'Yes') {
    spectaMetadata.hideTopbar = true;
  } else if (spectaMetadata.hideTopbar === 'No') {
    spectaMetadata.hideTopbar = false;
  } else {
    if (
      spectaConfig.hideTopbar === null ||
      spectaConfig.hideTopbar === undefined
    ) {
      // Show topbar by default if not specified in the global config
      // and notebook metadata
      spectaMetadata.hideTopbar = false;
    }
  }
  if (!spectaMetadata.hideTopbar) {
    spectaMetadata.topBar = {};
    if (spectaMetadata.topbarTitle && spectaMetadata.topbarTitle !== '') {
      spectaMetadata.topBar.title = spectaMetadata.topbarTitle;
      delete spectaMetadata.topbarTitle;
    } else if (!fileConfig?.topBar?.title) {
      spectaMetadata.topBar.title = pathWithoutDrive;
    }
    if (spectaMetadata.topbarThemeToggle === 'No') {
      spectaMetadata.topBar.themeToggle = false;
    } else {
      spectaMetadata.topBar.themeToggle = true;
    }
    delete spectaMetadata.topbarThemeToggle;
  }

  // merge spectaConfig and spectaMetadata (spectaMetadata has higher priority
  return mergeObjects(spectaConfig, spectaMetadata);
}

export function readCellConfig(cell?: ICell): Required<ISpectaCellConfig> {
  const metaData = (cell?.metadata?.specta ?? {}) as any;
  const spectaCellConfig: Required<ISpectaCellConfig> = {
    showSource: false,
    showOutput: true,
    outputSize: 'Small'
  };

  if (metaData.showSource && metaData.showSource === 'Yes') {
    spectaCellConfig.showSource = true;
  }

  if (metaData.showOutput && metaData.showOutput === 'No') {
    spectaCellConfig.showOutput = false;
  }

  if (metaData.outputSize) {
    spectaCellConfig.outputSize = metaData.outputSize;
  }

  return spectaCellConfig;
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay = 100
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
export const emitResizeEvent = debounce(() => {
  window.dispatchEvent(new Event('resize'));
});

export function setRevealTheme(themeName: string) {
  let themeLink = document.getElementById(
    'reveal-theme'
  ) as HTMLLinkElement | null;

  if (!themeLink) {
    // Create <link> tag if it doesn't exist
    themeLink = document.createElement('link');
    themeLink.rel = 'stylesheet';
    themeLink.id = 'reveal-theme';
    document.head.appendChild(themeLink);
  }

  // Set or update href to new theme
  themeLink.href = getSpectaAssetUrl(`reveal.js/${themeName}.css`);
}

export async function configLabLayout(options: {
  config?: ISpectaAppConfig['labConfig'];
  labShell: ILabShell;
  commands: CommandRegistry;
}): Promise<void> {
  const { config, labShell, commands } = options;
  if (!config) {
    return;
  }
  const {
    setSingleMode,
    hideLeftPanel,
    hideRightPanel,
    hideStatusbar,
    hideHeader
  } = config;
  if (setSingleMode) {
    await commands.execute('application:set-mode', {
      mode: 'single-document'
    });
  }
  if (hideLeftPanel) {
    labShell.collapseLeft();
    if (labShell.isSideTabBarVisible('left')) {
      labShell.toggleSideTabBarVisibility('left');
    }
  }
  if (hideRightPanel) {
    labShell.collapseRight();
    if (labShell.isSideTabBarVisible('right')) {
      labShell.toggleSideTabBarVisibility('right');
    }
  }
  if (hideHeader) {
    if (labShell.isTopInSimpleModeVisible()) {
      await commands.execute('application:toggle-header');
    }
  }
  if (hideStatusbar) {
    const statusBar = document.getElementById('jp-main-statusbar');
    if (statusBar && !statusBar.classList.contains('lm-mod-hidden')) {
      await commands.execute('statusbar:toggle');
    }
  }
}

export function getSpectaDocInfo(
  path: string,
  app: JupyterFrontEnd<any>
): { isSpectaDoc: boolean; factory: string } {
  const fileTypes = app.docRegistry.getFileTypesForPath(path);
  const plainbFileType = fileTypes.find(ft =>
    ft.name.startsWith(PLAINB_PREFIX)
  );
  const isPlainb = !!plainbFileType;
  const fileTypeName = plainbFileType
    ? plainbFileType.name
    : fileTypes[0]?.name;

  const isSpectaDoc = PathExt.extname(path) === '.ipynb' || isPlainb;
  const factory = isPlainb
    ? fileTypeName.replace(PLAINB_PREFIX, 'specta-')
    : 'specta';

  return { isSpectaDoc, factory };
}

export function openDocument(
  path: string,
  factory: string,
  docManager: IDocumentManager,
  shell: JupyterFrontEnd.IShell
): void {
  const widget = docManager.openOrReveal(path, factory);
  if (widget) {
    shell.add(widget, 'main');
  }
}
