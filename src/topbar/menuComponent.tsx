import { IThemeManager } from '@jupyterlab/apputils';
import React, { useState, useRef, useEffect } from 'react';

import { GearIcon } from '../components/icon/gear';
import { IconButton } from '../components/iconButton';
import { SettingContent } from './settingDialog';
import { ITopbarConfig, ISpectaWidget } from '../token';

interface IProps {
  config?: ITopbarConfig;
  themeManager?: IThemeManager;
  settingsWidgets?: ISpectaWidget[];
}

export function MenuComponent(props: IProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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
  return (
    <div className="specta-topbar-right">
      <IconButton
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        icon={
          <GearIcon fill="var(--jp-ui-font-color2)" height={23} width={23} />
        }
      />

      {open && (
        <div ref={dialogRef} className="jp-Dialog-content specta-config-dialog">
          <div className="specta-config-arrow" />
          <SettingContent
            config={props.config}
            themeManager={props.themeManager}
            settingsWidgets={props.settingsWidgets}
          />
        </div>
      )}
    </div>
  );
}
