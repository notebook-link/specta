import { ISignal, Signal } from '@lumino/signaling';
import { ISpectaLayout, ISpectaLayoutRegistry } from '../token';
import { DashboardLayout } from './default';
import { ArticleLayout } from './article';
import { SlidesLayout } from './slides';

// 'default' was renamed to 'dashboard', this is for backwards compatibility
function legacyName(name: string): string {
  return name === 'default' ? 'dashboard' : name;
}

export class SpectaLayoutRegistry implements ISpectaLayoutRegistry {
  constructor() {
    const dashboardLayout = new DashboardLayout();
    const articleLayout = new ArticleLayout();
    this._registry = new Map<string, ISpectaLayout>();
    this._registry.set('article', articleLayout);
    this._registry.set('dashboard', dashboardLayout);
    this._registry.set('slides', new SlidesLayout());
    this._selectedLayout = {
      name: 'article',
      layout: articleLayout
    };
  }
  get layoutAdded(): ISignal<SpectaLayoutRegistry, string> {
    return this._layoutAdded;
  }

  get selectedLayout(): { name: string; layout: ISpectaLayout } {
    return this._selectedLayout;
  }

  get selectedLayoutChanged(): ISignal<
    SpectaLayoutRegistry,
    { name: string; layout: ISpectaLayout; oldLayout?: ISpectaLayout }
  > {
    return this._selectedLayoutChanged;
  }
  get(name: string): ISpectaLayout | undefined {
    return this._registry.get(legacyName(name));
  }

  getDefaultLayout(): ISpectaLayout {
    return this._registry.get('article')!;
  }

  async setSelectedLayout(name: string): Promise<void> {
    name = legacyName(name);
    if (!this._registry.has(name)) {
      throw new Error(`Layout with name ${name} does not exist`);
    }
    const oldLayout = this._selectedLayout.layout;
    this._selectedLayout = { name, layout: this._registry.get(name)! };
    this._selectedLayoutChanged.emit({ ...this._selectedLayout, oldLayout });
  }

  register(name: string, layout: ISpectaLayout): void {
    if (this._registry.has(name)) {
      throw new Error(`Layout with name ${name} already exists`);
    }
    this._registry.set(name, layout);
    this._layoutAdded.emit(name);
  }

  allLayouts(): string[] {
    return Array.from(this._registry.keys());
  }

  private _selectedLayout: { name: string; layout: ISpectaLayout };
  private _registry: Map<string, ISpectaLayout> = new Map();
  private _layoutAdded = new Signal<SpectaLayoutRegistry, string>(this);
  private _selectedLayoutChanged = new Signal<
    SpectaLayoutRegistry,
    { name: string; layout: ISpectaLayout; oldLayout?: ISpectaLayout }
  >(this);
}
