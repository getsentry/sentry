import type {LocationDescriptor} from 'history';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';

interface SaveAsAlertMenuItemBaseOptions {
  disabled?: boolean;
}

interface SaveAsAlertSubmenuOptions extends SaveAsAlertMenuItemBaseOptions {
  alertsUrls: MenuItemProps[];
  submenu: true;
  label?: string;
}

interface SaveAsAlertActionOptions extends SaveAsAlertMenuItemBaseOptions {
  onAction: () => void;
  to: LocationDescriptor;
  submenu?: false;
}

type SaveAsAlertMenuItemOptions = SaveAsAlertSubmenuOptions | SaveAsAlertActionOptions;

export function getCreateAlertLabel(): string {
  return t('Create a Monitor');
}

export function getCreateAlertForLabel(): string {
  return t('Create a Monitor for');
}

export function getSaveAsAlertMenuItem(
  options: SaveAsAlertMenuItemOptions
): MenuItemProps {
  const {disabled} = options;

  if (options.submenu) {
    const {alertsUrls} = options;
    const label = options.label ?? t('Monitor for');

    return {
      key: 'create-alert',
      label,
      textValue: label,
      children: alertsUrls,
      disabled: disabled || alertsUrls.length === 0,
      submenu: true,
    };
  }

  const label = getCreateAlertLabel();

  return {
    key: 'create-alert',
    label,
    textValue: label,
    disabled,
    to: options.to,
    onAction: options.onAction,
  };
}
