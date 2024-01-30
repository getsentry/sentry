import Footer from 'sentry/components/footer';
import Sidebar from 'sentry/components/sidebar';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import OrganizationLayout from 'sentry/views/organizationLayout';

import Body from './body';

interface Props {
  children: React.ReactNode;
}

function OrganizationDetails({children}: Props) {
  useRouteAnalyticsHookSetup();

  return (
    <OrganizationLayout>
      <Sidebar />
      <Body>{children}</Body>
      <Footer />
    </OrganizationLayout>
  );
}

export default OrganizationDetails;
