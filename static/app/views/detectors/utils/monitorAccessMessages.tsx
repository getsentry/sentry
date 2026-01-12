import {Link} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

function AlertsMemberWriteSettingsLink() {
  const organization = useOrganization();

  return (
    <Link
      to={{
        hash: 'alertsMemberWrite',
        pathname: `/settings/${organization.slug}/`,
      }}
    />
  );
}

export function getNoPermissionToEditMonitorTooltip() {
  return tct(
    'You do not have permission to edit this monitor. Ask your organization owner or manager to [settingsLink:enable monitor access] for you.',
    {settingsLink: <AlertsMemberWriteSettingsLink />}
  );
}

export function getNoPermissionToCreateMonitorsTooltip() {
  return tct(
    'You do not have permission to create monitors. Ask your organization owner or manager to [settingsLink:enable monitor access] for you.',
    {settingsLink: <AlertsMemberWriteSettingsLink />}
  );
}

export function getManagedBySentryMonitorEditTooltip() {
  return t(
    'This monitor is managed by Sentry. Only organization owners and managers can edit it.'
  );
}
