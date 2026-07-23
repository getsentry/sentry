import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {hasMetricAlerts} from 'sentry/views/alerts/utils';

interface SaveAsAlertMenuItemOptions {
  alertsUrls: MenuItemProps[];
  organization: Organization;
}

export function getMetricAlertsUpsellTooltip(
  organization: Organization
): string | undefined {
  if (hasMetricAlerts(organization)) {
    return undefined;
  }
  return organization.features.includes('workflow-engine-ui')
    ? t('Monitors are not available on your current plan.')
    : t('Alerts are not available on your current plan.');
}

export function getSaveAsAlertMenuItem({
  organization,
  alertsUrls,
}: SaveAsAlertMenuItemOptions): MenuItemProps {
  const isMonitor = organization.features.includes('workflow-engine-ui');
  const label = isMonitor ? t('Monitor for') : t('Alert for');
  const hasAccess = hasMetricAlerts(organization);

  return {
    key: 'create-alert',
    label,
    textValue: label,
    children: hasAccess ? alertsUrls : [],
    disabled: !hasAccess || alertsUrls.length === 0,
    tooltip: getMetricAlertsUpsellTooltip(organization),
    submenu: true,
  };
}
