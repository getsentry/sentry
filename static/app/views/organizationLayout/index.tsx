import {Outlet, ScrollRestoration} from 'react-router-dom';
import styled from '@emotion/styled';

import DemoHeader from 'sentry/components/demo/demoHeader';
import {useFeatureFlagOnboardingDrawer} from 'sentry/components/events/featureFlags/onboarding/featureFlagOnboardingSidebar';
import {useFeedbackOnboardingDrawer} from 'sentry/components/feedback/feedbackOnboarding/sidebar';
import Footer from 'sentry/components/footer';
import {GlobalDrawer} from 'sentry/components/globalDrawer';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {usePerformanceOnboardingDrawer} from 'sentry/components/performanceOnboarding/sidebar';
import {useProfilingOnboardingDrawer} from 'sentry/components/profiling/profilingOnboardingSidebar';
import {useReplaysOnboardingDrawer} from 'sentry/components/replaysOnboarding/sidebar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {Organization} from 'sentry/types/organization';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import useInitSentryToolbar from 'sentry/utils/useInitSentryToolbar';
import useOrganization from 'sentry/utils/useOrganization';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import {useRegisterDomainViewUsage} from 'sentry/views/insights/common/utils/domainRedirect';
import Nav from 'sentry/views/nav';
import {NavContextProvider} from 'sentry/views/nav/context';
import {OrganizationContainer} from 'sentry/views/organizationContainer';
import {useReleasesDrawer} from 'sentry/views/releases/drawer/useReleasesDrawer';

import OrganizationDetailsBody from './body';

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

function OrganizationLayout() {
  // XXX(epurkhiser): The OrganizationContainer is responsible for ensuring the
  // oganization is loaded before rendering children. Organization may not be
  // loaded yet when this first renders.
  const organization = useOrganization({allowNull: true});

  useInitSentryToolbar(organization);

  return (
    <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
      <GlobalAnalytics />
      <OrganizationContainer>
        <GlobalDrawer>
          <AppLayout organization={organization} />
        </GlobalDrawer>
      </OrganizationContainer>
      <ScrollRestoration getKey={location => location.pathname} />
    </SentryDocumentTitle>
  );
}

interface LayoutProps {
  organization: Organization | null;
}

function AppDrawers() {
  useFeedbackOnboardingDrawer();
  useReplaysOnboardingDrawer();
  usePerformanceOnboardingDrawer();
  useProfilingOnboardingDrawer();
  useFeatureFlagOnboardingDrawer();
  useReleasesDrawer();

  return null;
}

function AppLayout({organization}: LayoutProps) {
  return (
    <NavContextProvider>
      <AppContainer>
        <Nav />
        {/* The `#main` selector is used to make the app content `inert` when an overlay is active */}
        <BodyContainer id="main">
          <DemoHeader />
          <AppBodyContent>
            {organization && <OrganizationHeader organization={organization} />}
            <OrganizationDetailsBody>
              <Outlet />
            </OrganizationDetailsBody>
          </AppBodyContent>
          <Footer />
        </BodyContainer>
      </AppContainer>
      {organization ? <AppDrawers /> : null}
    </NavContextProvider>
  );
}

/**
 * Pulled into its own component to avoid re-rendering the OrganizationLayout
 * TODO: figure out why these analytics hooks trigger rerenders
 */
function GlobalAnalytics() {
  useRouteAnalyticsHookSetup();
  useRegisterDomainViewUsage();

  return null;
}

const AppContainer = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;

const BodyContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

export default OrganizationLayout;
