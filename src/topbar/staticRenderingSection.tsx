import React, { useCallback, useEffect, useRef, useState } from 'react';

import { IAppModel, IAppWidget } from '../token';

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
}) => {
  const model = props.spectaWidget?.model;
  const [snapshotState, setSnapshotState] = useState<ISnapshotState>(() =>
    readSnapshotState(model)
  );
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

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
    await model?.deleteSnapshot();
  }, [model, snapshotStatus]);

  const createSnapshot = useCallback(async () => {
    if (isStaticRendering || creatingRef.current) {
      return;
    }
    creatingRef.current = true;
    setCreatingSnapshot(true);
    try {
      await props.spectaWidget?.saveSnapshot();
    } finally {
      creatingRef.current = false;
      setCreatingSnapshot(false);
    }
  }, [props.spectaWidget, isStaticRendering]);

  const activateKernel = useCallback(async () => {
    if (!isStaticRendering) {
      return;
    }
    await props.spectaWidget?.turnOffStaticRender();
  }, [props.spectaWidget, isStaticRendering]);

  return (
    <div>
      <label htmlFor="">
        <b>Static rendering: {isStaticRendering ? 'On' : 'Off'}</b>
      </label>
      <div
        style={{
          marginBottom: '12px',
          display: 'flex',
          gap: '2px',
          flexDirection: 'column'
        }}
      >
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
            display: props.isSpectaApp ? 'none' : 'flex'
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
            display: props.spectaWidget ? 'flex' : 'none',
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
