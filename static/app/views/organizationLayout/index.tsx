import Footer from 'sentry/components/footer';
import HookOrDefault from 'sentry/components/hookOrDefault';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import useOrganization from 'sentry/utils/useOrganization';
import OrganizationContainer from 'sentry/views/organizationContainer';

import Body from './body';

interface Props {
  children: React.ReactNode;
}

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

function OrganizationLayout({children}: Props) {
  useRouteAnalyticsHookSetup();

  // XXX(epurkhiser): The OrganizationContainer is responsible for ensuring the
  // oganization is loaded before rendering children. Organization may not be
  // loaded yet when this first renders.
  const organization = useOrganization({allowNull: true});

  return (
    <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
      <OrganizationContainer>
        <div className="app">
          {organization && <OrganizationHeader organization={organization} />}
          <Sidebar />
          <Body>{children}</Body>
          <Footer />
        </div>
      </OrganizationContainer>
    </SentryDocumentTitle>
  );
}

export default OrganizationLayout;
