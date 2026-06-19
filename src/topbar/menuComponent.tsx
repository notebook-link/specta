import { IThemeManager } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { jupyterIcon, launchIcon } from '@jupyterlab/ui-components';
import React, { useState, useRef, useEffect } from 'react';

import { GearIcon } from '../components/icon/gear';
import { IconButton } from '../components/iconButton';
import { SettingContent } from './settingDialog';
import { ITopbarConfig } from '../token';
import { isSpectaApp } from '../tool';

interface IProps {
  config?: ITopbarConfig;
  themeManager?: IThemeManager;
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

  const isSpecta = isSpectaApp();
  const showOpenInLab = isSpecta && props.config?.openInToggle !== false;
  const showOpenInSpecta = !isSpecta;

  const openInApp = (app: 'lab' | 'specta') => {
    const baseUrl = PageConfig.getBaseUrl();
    const urlParams = new URLSearchParams(window.location.search);
    const path = urlParams.get('path');
    const targetUrl = path
      ? `${baseUrl}${app}/index.html?path=${encodeURIComponent(path)}`
      : `${baseUrl}${app}/index.html`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="specta-topbar-right"
      style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
    >
      {showOpenInLab && (
        <IconButton
          onClick={() => openInApp('lab')}
          title="Open in JupyterLab"
          icon={<jupyterIcon.react width="23px" height="23px" />}
        />
      )}
      {showOpenInSpecta && (
        <IconButton
          onClick={() => openInApp('specta')}
          title="Open in Standalone Specta"
          icon={<launchIcon.react width="23px" height="23px" />}
        />
      )}
      <IconButton
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        title="Settings"
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
          />
        </div>
      )}
    </div>
  );
}
