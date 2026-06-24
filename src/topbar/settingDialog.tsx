import { IThemeManager } from '@jupyterlab/apputils';
import React, { useState, useEffect, useCallback } from 'react';
import { Divider } from '../components/divider';
import {
  ISpectaLayoutRegistry,
  ISpectaUiSwitcher,
  ITopbarConfig
} from '../token';

export const SettingContent = (props: {
  config?: ITopbarConfig;
  themeManager?: IThemeManager;
  layoutRegistry?: ISpectaLayoutRegistry;
  uiSwitcher?: ISpectaUiSwitcher | null;
  currentPath?: string | null;
  currentUi?: string;
}) => {
  const { themeManager, layoutRegistry } = props;
  const [themeOptions, setThemeOptions] = useState<string[]>([
    ...(themeManager?.themes ?? [])
  ]);
  const [selectedTheme, setSelectedTheme] = useState<string>(
    themeManager?.theme ?? 'light'
  );

  const [layoutOptions, setLayoutOptions] = useState<string[]>(
    layoutRegistry?.allLayouts() ?? []
  );
  const [selectedLayout, setSelectedLayout] = useState<string>(
    layoutRegistry?.selectedLayout?.name ?? 'default'
  );
  useEffect(() => {
    let cb: any;
    if (themeManager) {
      cb = (sender: IThemeManager, args: any) => {
        if (args.newValue.length > 0) {
          return;
        }

        setThemeOptions([...themeManager.themes]);

        if (themeManager.theme) {
          setSelectedTheme(themeManager.theme);
        }
      };
      themeManager.themeChanged.connect(cb);
    }
    if (layoutRegistry) {
      const layoutAddedCb = (
        sender: ISpectaLayoutRegistry,
        newLayout: string
      ) => {
        setLayoutOptions(layoutRegistry.allLayouts());
      };

      layoutRegistry.layoutAdded.connect(layoutAddedCb);
    }

    return () => {
      if (themeManager && cb) {
        themeManager.themeChanged.disconnect(cb);
      }
    };
  }, [themeManager, layoutRegistry]);

  const onThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const theme = e.currentTarget?.value;
      if (theme) {
        themeManager?.setTheme(theme);
        setSelectedTheme(theme);
      }
    },
    [themeManager]
  );
  const onLayoutChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const layout = e.currentTarget?.value;
      if (layout && layoutRegistry) {
        layoutRegistry.setSelectedLayout(layout);
        setSelectedLayout(layout);
      }
    },
    [layoutRegistry]
  );
  const { uiSwitcher, currentPath } = props;
  const onUiChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const ui = e.currentTarget?.value;
      if (ui && uiSwitcher && currentPath) {
        uiSwitcher.switchTo(currentPath, ui);
      }
    },
    [uiSwitcher, currentPath]
  );
  return (
    <div style={{ padding: '0 10px' }}>
      <p style={{ marginTop: 0, marginBottom: '5px', fontSize: '1rem' }}>
        SETTINGS
      </p>
      <Divider />
      {(props.config?.layoutToggle !== undefined
        ? props.config.layoutToggle
        : true) &&
        layoutRegistry && (
          <div>
            <label htmlFor="">Select layout</label>
            <div className="jp-select-wrapper">
              <select
                className=" jp-mod-styled specta-topbar-theme"
                onChange={onLayoutChange}
                value={selectedLayout}
              >
                {layoutOptions.map(el => {
                  return (
                    <option
                      key={el}
                      value={el}
                      style={{
                        background: 'var(--jp-layout-color2)'
                      }}
                    >
                      {el.charAt(0).toUpperCase() + el.slice(1)}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}
      {(props.config?.themeToggle !== undefined
        ? props.config.themeToggle
        : true) &&
        themeManager && (
          <div>
            <label htmlFor="">Select theme</label>
            <div className="jp-select-wrapper">
              <select
                className=" jp-mod-styled specta-topbar-theme"
                onChange={onThemeChange}
                value={selectedTheme}
              >
                {themeOptions.map(el => {
                  return (
                    <option
                      key={el}
                      value={el}
                      style={{
                        background: 'var(--jp-layout-color2)'
                      }}
                    >
                      {el}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}
      {currentPath && uiSwitcher && uiSwitcher.uis.length > 0 && (
        <div>
          <label htmlFor="">Select UI</label>
          <div className="jp-select-wrapper">
            <select
              className=" jp-mod-styled specta-topbar-theme"
              onChange={onUiChange}
              value={props.currentUi}
            >
              {uiSwitcher.uis.map(ui => {
                return (
                  <option
                    key={ui.id}
                    value={ui.id}
                    style={{ background: 'var(--jp-layout-color2)' }}
                  >
                    {ui.label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
