import {Fragment} from 'react';
import {Outlet, ScrollRestoration} from 'react-router-dom';
import styled from '@emotion/styled';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';

import {DemoHeader} from 'sentry/components/demo/demoHeader';
import {useFeatureFlagOnboardingDrawer} from 'sentry/components/events/featureFlags/onboarding/featureFlagOnboardingSidebar';
import {useFeedbackOnboardingDrawer} from 'sentry/components/feedback/feedbackOnboarding/sidebar';
import {Footer} from 'sentry/components/footer';
import Hook from 'sentry/components/hook';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePerformanceOnboardingDrawer} from 'sentry/components/performanceOnboarding/sidebar';
import {useProfilingOnboardingDrawer} from 'sentry/components/profiling/profilingOnboardingSidebar';
import {useReplaysOnboardingDrawer} from 'sentry/components/replaysOnboarding/sidebar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useRouteAnalyticsHookSetup} from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import {useInitSentryToolbar} from 'sentry/utils/useInitSentryToolbar';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import SystemAlerts from 'sentry/views/app/systemAlerts';
import {useReleasesDrawer} from 'sentry/views/explore/releases/drawer/useReleasesDrawer';
import {useRegisterDomainViewUsage} from 'sentry/views/insights/common/utils/domainRedirect';
import {Navigation} from 'sentry/views/navigation';
import {NavigationSidebarShell} from 'sentry/views/navigation/navigationShell';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';
import {TopBar} from 'sentry/views/navigation/topBar';
import {OrganizationContainer} from 'sentry/views/organizationContainer';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {OrganizationDetailsBody} from './body';

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

export function OrganizationLayout() {
  const organization = useOrganization({allowNull: true});

  useInitSentryToolbar(organization);

  return (
    <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
      <GlobalAnalytics />
      <GlobalDrawer>
        <SeerExplorerContextProvider>
          <AppLayout organization={organization} />
        </SeerExplorerContextProvider>
      </GlobalDrawer>
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
  const {loading} = useLegacyStore(OrganizationStore);

  return (
    <PrimaryNavigationContextProvider>
      {loading ? <AppShell /> : <AppContent organization={organization} />}
    </PrimaryNavigationContextProvider>
  );
}

function AppShell() {
  return (
    <Stack flex="1" minWidth="0" minHeight="100dvh">
      <SystemAlerts className="messages-container" />
      <Flex
        flex="1"
        minWidth="0"
        minHeight="0"
        direction={{sm: 'column', md: 'row'}}
        position="relative"
      >
        <NavigationSidebarShell />
        {/* The `#main` selector is used to make the app content `inert` when an overlay is active */}
        <ContentStack
          id="main"
          tabIndex={-1}
          flex="1"
          minWidth="0"
          background="secondary"
        >
          <AppBodyContent>
            <OrganizationDetailsBody>
              <TopBar.Slot.Provider>
                <TopBar />
              </TopBar.Slot.Provider>
            </OrganizationDetailsBody>
          </AppBodyContent>
        </ContentStack>
      </Flex>
    </Stack>
  );
}

function AppContent({organization}: LayoutProps) {
  const showSuperuserWarning =
    !!organization &&
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  return (
    <Fragment>
      <Stack flex="1" minWidth="0" minHeight="100dvh">
        {showSuperuserWarning && (
          <Hook name="component:superuser-warning" organization={organization} />
        )}
        <SystemAlerts className="messages-container" />
        <Flex
          flex="1"
          minWidth="0"
          minHeight="0"
          direction={{sm: 'column', md: 'row'}}
          position="relative"
        >
          <Navigation />
          {/* The `#main` selector is used to make the app content `inert` when an overlay is active */}
          <ContentStack
            id="main"
            tabIndex={-1}
            flex="1"
            minWidth="0"
            background="secondary"
          >
            <DemoHeader />
            <AppBodyContent>
              {organization && <OrganizationHeader organization={organization} />}
              <OrganizationDetailsBody>
                <TopBar.Slot.Provider>
                  <TopBar />
                  <OrganizationContainer>
                    <Layout.Page>
                      <Outlet />
                      <Footer />
                    </Layout.Page>
                  </OrganizationContainer>
                </TopBar.Slot.Provider>
              </OrganizationDetailsBody>
            </AppBodyContent>
          </ContentStack>
        </Flex>
      </Stack>
      <AppDrawers />
    </Fragment>
  );
}

const ContentStack = styled(Stack)`
  &:focus-visible {
    outline: none;
    box-shadow: none;
  }
`;

/**
 * Pulled into its own component to avoid re-rendering the OrganizationLayout
 * TODO: figure out why these analytics hooks trigger rerenders
 */
function GlobalAnalytics() {
  useRouteAnalyticsHookSetup();
  useRegisterDomainViewUsage();

  return null;
}
