import {cloneElement, isValidElement} from 'react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
};

function AlertsContainer({children}: Props) {
  const organization = useOrganization();
  const hasMetricAlerts = organization.features.includes('incidents');
  const hasUptimeAlerts = organization.features.includes('uptime-rule-api');

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
