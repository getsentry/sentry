import Footer from 'sentry/components/footer';
import HookOrDefault from 'sentry/components/hookOrDefault';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import useDevToolbar from 'sentry/utils/useDevToolbar';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import useOrganization from 'sentry/utils/useOrganization';
import OrganizationContainer from 'sentry/views/organizationContainer';

import Body from './body';

interface Props {
  children: React.ReactNode;
}

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

function DevToolInit() {
  const isEmployee = useIsSentryEmployee();
  const organization = useOrganization();
  const showDevToolbar = organization.features.includes('devtoolbar');
  useDevToolbar({enabled: showDevToolbar && isEmployee});
  return null;
}

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
          {organization && <DevToolInit />}
          <Sidebar />
          <Body>{children}</Body>
          <Footer />
        </div>
      </OrganizationContainer>
    </SentryDocumentTitle>
  );
}

export default OrganizationLayout;
