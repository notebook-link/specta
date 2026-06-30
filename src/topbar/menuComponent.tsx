import { IThemeManager } from '@jupyterlab/apputils';
import React, { useState, useRef, useEffect } from 'react';
import { ISignal } from '@lumino/signaling';

import { GearIcon } from '../components/icon/gear';
import { IconButton } from '../components/iconButton';
import { SettingContent } from './settingDialog';
import { ISpectaUiSwitcher, ITopbarConfig, ISpectaWidget } from '../token';

interface IProps {
  config?: ITopbarConfig;
  themeManager?: IThemeManager;
  settingsWidgets?: ISpectaWidget[];
  uiSwitcher?: ISpectaUiSwitcher | null;
  currentPath?: string | null;
  currentUi?: string;
  settingsIconChanged?: ISignal<any, JSX.Element>;
  customIcon?: JSX.Element;
}

export function MenuComponent(props: IProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [customIcon, setCustomIcon] = useState<JSX.Element | undefined>(props.customIcon);

  useEffect(() => {
    setCustomIcon(props.customIcon);
  }, [props.customIcon]);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const signal = props.settingsIconChanged;
    if (!signal) {
      return;
    }
    const handler = (_sender: any, icon: JSX.Element) => {
      setCustomIcon(icon);
    };
    signal.connect(handler);
    return () => {
      signal.disconnect(handler);
    };
  }, [props.settingsIconChanged]);

  const menuIcon = customIcon || (
    <GearIcon fill="var(--jp-ui-font-color2)" height={23} width={23} />
  );

  return (
    <div className="specta-topbar-right">
      <IconButton
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        icon={menuIcon}
      />

      {open && (
        <div ref={dialogRef} className="jp-Dialog-content specta-config-dialog">
          <div className="specta-config-arrow" />
          <SettingContent
            config={props.config}
            themeManager={props.themeManager}
            settingsWidgets={props.settingsWidgets}
            uiSwitcher={props.uiSwitcher}
            currentPath={props.currentPath}
            currentUi={props.currentUi}
          />
        </div>
      )}
    </div>
  );
}
