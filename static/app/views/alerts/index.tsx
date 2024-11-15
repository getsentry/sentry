import {cloneElement, isValidElement} from 'react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
};

function AlertsContainer({children}: Props) {
  const organization = useOrganization();
  const hasMetricAlerts = organization.features.includes('incidents');

  // Uptime alerts are not behind a feature flag at the moment
  const hasUptimeAlerts = true;

  const content =
    children && isValidElement(children)
      ? cloneElement<any>(children, {
          organization,
          hasMetricAlerts,
          hasUptimeAlerts,
        })
      : children;

  return <NoProjectMessage organization={organization}>{content}</NoProjectMessage>;
}

export default AlertsContainer;
