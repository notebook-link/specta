import React, { useCallback, useEffect, useRef, useState } from 'react';

import { IAppModel, IAppWidget, ISpectaAppConfig } from '../token';
import { showDialog, Dialog } from '@jupyterlab/apputils';

type ISnapshotState = {
  status: 'out-of-sync' | 'in-sync' | 'not-exist';
  timestamp?: number;
  staticRender: boolean;
};

function readSnapshotState(model?: IAppModel): ISnapshotState {
  return {
    status: model?.snapshotStatus() ?? 'not-exist',
    timestamp: model?.getSnapshot()?.timestamp,
    staticRender: Boolean(model?.staticRender)
  };
}

export const StaticRenderingSection = (props: {
  spectaWidget?: IAppWidget;
  isSpectaApp?: boolean;
  spectaConfig?: ISpectaAppConfig;
  disableOutsideClickTest: (value: boolean) => void;
}) => {
  const { isSpectaApp, spectaConfig, disableOutsideClickTest, spectaWidget } =
    props;
  const model = spectaWidget?.model;
  const [snapshotState, setSnapshotState] = useState<ISnapshotState>(() =>
    readSnapshotState(model)
  );
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [enableStaticRendering, setEnableStaticRendering] = useState(
    Boolean(spectaConfig?.enableStaticRendering)
  );
  const {
    status: snapshotStatus,
    timestamp: currentTimestamp,
    staticRender: isStaticRendering
  } = snapshotState;

  useEffect(() => {
    if (!model) {
      return;
    }
    const handler = () => setSnapshotState(readSnapshotState(model));
    model.snapshotChanged.connect(handler);
    return () => {
      model.snapshotChanged.disconnect(handler);
    };
  }, [model]);

  const creatingRef = useRef(false);

  const deleteSnapshot = useCallback(async () => {
    if (snapshotStatus === 'not-exist') {
      return;
    }
    disableOutsideClickTest(true);
    const response = await showDialog({
      title: 'Delete render cache',
      body: 'Do you want to delete the current render cache?',
      buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'Delete' })]
    });
    disableOutsideClickTest(false);
    if (response.button.accept !== true) {
      return;
    }
    await model?.deleteSnapshot();
  }, [model, snapshotStatus, disableOutsideClickTest]);

  const createSnapshot = useCallback(async () => {
    if (isStaticRendering || creatingRef.current) {
      return;
    }

    disableOutsideClickTest(true);
    const response = await showDialog({
      title: 'Save render cache',
      body: 'A cache of the current notebook outputs will be saved. This will allow users to view the notebook without a running kernel, but all kernel-based interactions will be disabled.',
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Save' })]
    });
    disableOutsideClickTest(false);
    if (response.button.accept !== true) {
      return;
    }
    creatingRef.current = true;
    setCreatingSnapshot(true);
    try {
      await spectaWidget?.saveSnapshot();
    } finally {
      creatingRef.current = false;
      setCreatingSnapshot(false);
    }
  }, [spectaWidget, isStaticRendering, disableOutsideClickTest]);

  const activateKernel = useCallback(async () => {
    if (!isStaticRendering) {
      return;
    }
    await spectaWidget?.turnOffStaticRender();
  }, [spectaWidget, isStaticRendering]);

  const onStaticRenderingChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value === 'on';
      setEnableStaticRendering(value);
      spectaWidget?.model.setEnableStaticRendering(value);
    },
    [spectaWidget]
  );
  return (
    <div>
      <label htmlFor="">
        <b>Static rendering</b>
      </label>
      <div className="jp-select-wrapper">
        <select
          className=" jp-mod-styled specta-topbar-theme"
          value={enableStaticRendering ? 'on' : 'off'}
          onChange={onStaticRenderingChange}
        >
          <option
            value={'off'}
            style={{ background: 'var(--jp-layout-color2)' }}
          >
            Disable
          </option>
          <option
            value={'on'}
            style={{ background: 'var(--jp-layout-color2)' }}
          >
            Enable
          </option>
        </select>
      </div>
      <div
        style={{
          marginBottom: '12px',
          display: 'flex',
          gap: '2px',
          flexDirection: 'column'
        }}
      >
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          Current render mode:{' '}
          {isStaticRendering ? 'Saved cache' : 'Live kernel'}
        </div>
        {snapshotStatus !== 'not-exist' && (
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            Last cache:{' '}
            {currentTimestamp
              ? new Date(currentTimestamp).toLocaleString()
              : 'Unavailable'}
          </div>
        )}
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          {snapshotStatus === 'not-exist'
            ? 'No render cache found'
            : snapshotStatus === 'out-of-sync'
              ? 'Render cache is out of sync with the notebook'
              : ''}
        </div>

        <div
          style={{
            gap: '8px',
            flexDirection: 'row',
            marginBottom: '4px',
            display: isSpectaApp ? 'none' : 'flex'
          }}
        >
          <button
            className="jp-mod-styled jp-mod-warn"
            onClick={deleteSnapshot}
            disabled={snapshotStatus === 'not-exist'}
            style={{
              cursor:
                snapshotStatus === 'not-exist' ? 'not-allowed' : 'pointer',
              flexGrow: 1,
              opacity: snapshotStatus === 'not-exist' ? 0.5 : 1
            }}
          >
            Clear cache
          </button>
          <button
            className="jp-mod-styled jp-mod-accept"
            onClick={createSnapshot}
            style={{
              cursor:
                isStaticRendering || creatingSnapshot
                  ? 'not-allowed'
                  : 'pointer',
              flexGrow: 1,
              opacity: isStaticRendering || creatingSnapshot ? 0.5 : 1
            }}
            disabled={isStaticRendering || creatingSnapshot}
            title={
              isStaticRendering
                ? 'Cannot save render cache in static rendering mode'
                : ''
            }
          >
            {creatingSnapshot ? 'Saving...' : 'Save cache'}
          </button>
        </div>
        <div
          style={{
            display: spectaWidget ? 'flex' : 'none',
            justifyContent: 'center'
          }}
        >
          <button
            className="jp-mod-styled jp-mod-accept"
            onClick={activateKernel}
            disabled={!isStaticRendering}
            style={{
              cursor: !isStaticRendering ? 'not-allowed' : 'pointer',
              flexGrow: 1,
              opacity: !isStaticRendering ? 0.5 : 1
            }}
            title="Render notebook using a live kernel"
          >
            Render with kernel
          </button>
        </div>
      </div>
    </div>
  );
};
