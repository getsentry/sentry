import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import OrganizationLayout from 'sentry/views/organizationLayout';

import Body from './body';

interface Props {
  children: React.ReactNode;
}

function OrganizationDetails({children}: Props) {
  useRouteAnalyticsHookSetup();

  return (
    <OrganizationLayout includeSidebar>
      <Body>{children}</Body>
    </OrganizationLayout>
  );
}

export default OrganizationDetails;
