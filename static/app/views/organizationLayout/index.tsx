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
import type {Organization} from 'sentry/types/organization';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useRouteAnalyticsHookSetup} from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import {useInitSentryToolbar} from 'sentry/utils/useInitSentryToolbar';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import {SystemAlerts} from 'sentry/views/app/systemAlerts';
import {useReleasesDrawer} from 'sentry/views/explore/releases/drawer/useReleasesDrawer';
import {useRegisterDomainViewUsage} from 'sentry/views/insights/common/utils/domainRedirect';
import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {OrganizationContainer} from 'sentry/views/organizationContainer';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {OrganizationDetailsBody} from './body';

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

export function OrganizationLayout() {
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
          <SeerExplorerContextProvider>
            <AppLayout organization={organization} />
          </SeerExplorerContextProvider>
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
  const hasPageFrame = useHasPageFrameFeature();
  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  return (
    <PrimaryNavigationContextProvider>
      <Stack flex="1" minWidth="0" minHeight="100dvh">
        {hasPageFrame && showSuperuserWarning && (
          <Hook name="component:superuser-warning" organization={organization} />
        )}
        {hasPageFrame && <SystemAlerts className="messages-container" />}
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
            background={hasPageFrame ? 'secondary' : undefined}
          >
            <DemoHeader />
            <AppBodyContent>
              {organization && <OrganizationHeader organization={organization} />}
              <OrganizationDetailsBody>
                <TopBar.Slot.Provider>
                  <TopBar />
                  <Layout.Page>
                    <Outlet />
                    <Footer />
                  </Layout.Page>
                </TopBar.Slot.Provider>
              </OrganizationDetailsBody>
            </AppBodyContent>
          </ContentStack>
        </Flex>
      </Stack>
      {organization ? <AppDrawers /> : null}
    </PrimaryNavigationContextProvider>
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
