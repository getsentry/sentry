import {Outlet} from 'react-router-dom';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

function AlertsContainer() {
  const organization = useOrganization();
  const hasMetricAlerts = organization.features.includes('incidents');

  // Uptime alerts are not behind a feature flag at the moment
  const hasUptimeAlerts = true;

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/alerts/',
    newPathPrefix: '/issues/alerts/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <NoProjectMessage organization={organization}>
      <Outlet context={{organization, hasMetricAlerts, hasUptimeAlerts}} />
    </NoProjectMessage>
  );
}

export default AlertsContainer;
