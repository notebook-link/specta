import * as nbformat from '@jupyterlab/nbformat';
import { ReactWidget } from '@jupyterlab/ui-components';
import { Panel, Widget } from '@lumino/widgets';
import React from 'react';

import { RandomSkeleton } from './components/cellSkeleton';
import { ISpectaCellConfig } from './token';

export interface ICellInfo {
  hidden?: boolean;
  cellModel?: nbformat.ICell;
  cellIndex?: number;
}
export class SpectaCellOutput extends Panel {
  constructor({
    cellIdentity,
    cell,
    sourceCell,
    info,
    cellConfig
  }: {
    cellIdentity: string;
    cell: Widget;
    sourceCell?: Widget;
    info: ICellInfo;
    cellConfig: Required<ISpectaCellConfig>;
  }) {
    super();
    const { showOutput, outputSize } = cellConfig;
    this.removeClass('lm-Widget');
    this.removeClass('p-Widget');
    this.addClass('specta-cell-output');

    if (outputSize === 'Big') {
      this.addClass('specta-cell-output-big');
    } else if (outputSize === 'Full') {
      this.addClass('specta-cell-output-full');
    }
    const content = new Panel();
    content.addClass('specta-cell-content');

    cell.addClass('specta-item-widget');
    if (sourceCell) {
      content.addWidget(sourceCell);
    }
    content.addWidget(cell);
    this.addWidget(content);
    this._cellOutput = cell;
    this.cellIdentity = cellIdentity;
    this._info = info ?? {};
    if (info.cellModel?.cell_type === 'code') {
      if (showOutput) {
        this._placeholder = ReactWidget.create(<RandomSkeleton />);
        this._placeholder.addClass('specta-cell-placeholder');
        this.addWidget(this._placeholder);
      }
    }
  }
  readonly cellIdentity: string;

  executionDone: Promise<void> = Promise.resolve();

  get cellOutput(): Widget {
    return this._cellOutput;
  }

  get info(): ICellInfo {
    return this._info;
  }

  removePlaceholder(): void {
    if (this._placeholder) {
      this._placeholder?.dispose();
    }
  }

  private _info: ICellInfo = {};
  private _cellOutput: Widget;
  private _placeholder?: Widget = undefined;
}
