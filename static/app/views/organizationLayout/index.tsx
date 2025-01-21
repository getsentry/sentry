import styled from '@emotion/styled';

import Footer from 'sentry/components/footer';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Nav from 'sentry/components/nav';
import {NavContextProvider} from 'sentry/components/nav/context';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import type {Organization} from 'sentry/types/organization';
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
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');
  const App = hasNavigationV2 ? AppLayout : LegacyAppLayout;

  return (
    <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
      <OrganizationContainer>
        <App organization={organization}>{children}</App>
      </OrganizationContainer>
    </SentryDocumentTitle>
  );
}

interface LayoutProps extends Props {
  organization: Organization | null;
}

function AppLayout({children, organization}: LayoutProps) {
  return (
    <NavContextProvider>
      <AppContainer className="app">
        <Nav />
        {/* The `#main` selector is used to make the app content `inert` when an overlay is active */}
        <BodyContainer id="main">
          {organization && <OrganizationHeader organization={organization} />}
          {organization && <DevToolInit />}
          <Body>{children}</Body>
          <Footer />
        </BodyContainer>
      </AppContainer>
    </NavContextProvider>
  );
}

function LegacyAppLayout({children, organization}: LayoutProps) {
  return (
    <div className="app">
      {organization && <OrganizationHeader organization={organization} />}
      {organization && <DevToolInit />}
      <Sidebar />
      <Body>{children}</Body>
      <Footer />
    </div>
  );
}

const AppContainer = styled('div')`
  display: flex;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;

const BodyContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export default OrganizationLayout;
