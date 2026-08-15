import { Panel, Widget } from '@lumino/widgets';
import { SpectaCellOutput } from '../specta_cell_output';
import * as nbformat from '@jupyterlab/nbformat';
import { ISpectaAppConfig, ISpectaLayout } from '../token';
import Reveal from 'reveal.js';
import { emitResizeEvent, setRevealTheme } from '../tool';

interface ISlideElement {
  type: 'slide' | 'subslide' | 'fragment';
  widget: Widget[];
}
class HostPanel extends Panel {
  constructor() {
    super();
    this.addClass('specta-slides-host-widget');
    this.addClass('reveal');
    this._outputs = new Panel();
    this._outputs.addClass('slides');
    this.addWidget(this._outputs);
  }

  addOutput(slideEl: ISlideElement): void {
    const { type, widget } = slideEl;
    const sectionWidget = new Widget({
      node: document.createElement('section')
    });
    switch (type) {
      case 'slide': {
        const outputWidget = widget[0];
        sectionWidget.node.appendChild(outputWidget.node);
        outputWidget.parent = sectionWidget;
        sectionWidget.processMessage = msg => {
          outputWidget.processMessage(msg);
        };
        break;
      }
      case 'subslide': {
        for (const outputWidget of widget) {
          const subSection = document.createElement('section');
          subSection.appendChild(outputWidget.node);
          outputWidget.parent = sectionWidget;
          sectionWidget.node.appendChild(subSection);
        }
        sectionWidget.processMessage = msg => {
          widget.forEach(w => w.processMessage(msg));
        };
        break;
      }
      case 'fragment': {
        for (const [idx, outputWidget] of widget.entries()) {
          if (idx !== 0) {
            outputWidget.addClass('fragment');
            outputWidget.addClass('fade-in');
          }
          sectionWidget.node.appendChild(outputWidget.node);
          outputWidget.parent = sectionWidget;
        }
        sectionWidget.processMessage = msg => {
          widget.forEach(w => w.processMessage(msg));
        };
        break;
      }
      default:
        break;
    }

    this._outputs.addWidget(sectionWidget);
  }
  private _outputs: Panel;
}
export class SlidesLayout implements ISpectaLayout {
  async render(options: {
    host: Panel;
    items: SpectaCellOutput[];
    notebook: nbformat.INotebookContent;
    readyCallback: () => Promise<void>;
    spectaConfig: ISpectaAppConfig;
  }): Promise<void> {
    const theme = options.spectaConfig.slidesTheme;
    if (theme) {
      setRevealTheme(theme);
    }
    const { host, items, readyCallback } = options;
    const hostPanel = new HostPanel();
    const elementList: ISlideElement[] = [];
    for (const el of items) {
      const info = el.info;
      const cellMeta = (info.cellModel?.metadata ?? {}) as any;
      const slideType = cellMeta?.slideshow?.slide_type;

      if (!info.hidden) {
        const lastEl = elementList[elementList.length - 1] as
          ISlideElement | undefined;
        switch (slideType) {
          case 'subslide': {
            if (lastEl?.type === 'subslide') {
              lastEl.widget.push(el);
            } else {
              elementList.push({ type: 'subslide', widget: [el] });
            }
            break;
          }
          case 'fragment': {
            if (lastEl?.type === 'fragment') {
              lastEl.widget.push(el);
            } else {
              elementList.push({ type: 'fragment', widget: [el] });
            }
            break;
          }
          case 'slide': {
            elementList.push({ type: 'slide', widget: [el] });
            break;
          }
          default: {
            elementList.push({ type: 'slide', widget: [el] });
            break;
          }
        }
      }
    }
    for (const element of elementList) {
      hostPanel.addOutput(element);
    }

    host.addWidget(hostPanel);
    await readyCallback();

    const deck = new Reveal(hostPanel.node, {
      embedded: true
    });
    deck.initialize();
    deck.on('slidetransitionend', event => {
      emitResizeEvent();
    });

    this._deckMap.set(host.node, deck);
  }

  private _deckMap = new WeakMap<HTMLElement, Reveal.Api>();
}
