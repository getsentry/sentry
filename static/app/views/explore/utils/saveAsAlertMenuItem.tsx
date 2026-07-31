import type {LocationDescriptor} from 'history';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {hasMetricAlerts} from 'sentry/views/alerts/utils';

interface SaveAsAlertMenuItemBaseOptions {
  organization: Organization;
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

function isMonitorOrg(organization: Organization): boolean {
  return organization.features.includes('workflow-engine-ui');
}

export function getMetricAlertsUpsellTooltip(
  organization: Organization
): string | undefined {
  if (hasMetricAlerts(organization)) {
    return undefined;
  }
  return isMonitorOrg(organization)
    ? t('Monitors are not available on your current plan.')
    : t('Alerts are not available on your current plan.');
}

export function getCreateAlertLabel(organization: Organization): string {
  return isMonitorOrg(organization) ? t('Create a Monitor') : t('Create an Alert');
}

export function getCreateAlertForLabel(organization: Organization): string {
  return isMonitorOrg(organization)
    ? t('Create a Monitor for')
    : t('Create an Alert for');
}

export function getSaveAsAlertMenuItem(
  options: SaveAsAlertMenuItemOptions
): MenuItemProps {
  const {organization, disabled} = options;
  const tooltip = getMetricAlertsUpsellTooltip(organization);
  const hasAccess = !tooltip;

  if (options.submenu) {
    const {alertsUrls} = options;
    const label =
      options.label ?? (isMonitorOrg(organization) ? t('Monitor for') : t('Alert for'));

    return {
      key: 'create-alert',
      label,
      textValue: label,
      children: hasAccess ? alertsUrls : [],
      disabled: disabled || !hasAccess || alertsUrls.length === 0,
      tooltip,
      submenu: true,
    };
  }

  const label = getCreateAlertLabel(organization);

  return {
    key: 'create-alert',
    label,
    textValue: label,
    disabled: disabled || !hasAccess,
    tooltip,
    to: options.to,
    onAction: options.onAction,
  };
}
