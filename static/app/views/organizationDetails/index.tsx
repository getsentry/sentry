import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import OrganizationLayout from 'sentry/views/organizationLayout';

import Body from './body';
import useOrganization from 'sentry/utils/useOrganization';
import Sidebar from 'sentry/components/sidebar';

interface Props {
  children: React.ReactNode;
}

function OrganizationDetails({children}: Props) {
  useRouteAnalyticsHookSetup();
  const organization = useOrganization({allowNull: true});

  return (
    <OrganizationLayout>
      <Sidebar organization={organization ?? undefined} />
      <Body>{children}</Body>
    </OrganizationLayout>
  );
}

export default OrganizationDetails;
