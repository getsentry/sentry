import Footer from 'sentry/components/footer';
import Sidebar from 'sentry/components/sidebar';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import useOrganization from 'sentry/utils/useOrganization';
import OrganizationLayout from 'sentry/views/organizationLayout';

import Body from './body';

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
      <Footer />
    </OrganizationLayout>
  );
}

export default OrganizationDetails;
