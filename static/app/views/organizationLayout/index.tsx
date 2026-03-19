import {Outlet, ScrollRestoration} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {DemoHeader} from 'sentry/components/demo/demoHeader';
import {useFeatureFlagOnboardingDrawer} from 'sentry/components/events/featureFlags/onboarding/featureFlagOnboardingSidebar';
import {useFeedbackOnboardingDrawer} from 'sentry/components/feedback/feedbackOnboarding/sidebar';
import {Footer} from 'sentry/components/footer';
import {GlobalDrawer} from 'sentry/components/globalDrawer';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePerformanceOnboardingDrawer} from 'sentry/components/performanceOnboarding/sidebar';
import {useProfilingOnboardingDrawer} from 'sentry/components/profiling/profilingOnboardingSidebar';
import {useReplaysOnboardingDrawer} from 'sentry/components/replaysOnboarding/sidebar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {AlertStore} from 'sentry/stores/alertStore';
import type {Organization} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import {useRouteAnalyticsHookSetup} from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import {useApi} from 'sentry/utils/useApi';
import {useInitSentryToolbar} from 'sentry/utils/useInitSentryToolbar';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import {useRegisterDomainViewUsage} from 'sentry/views/insights/common/utils/domainRedirect';
import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';
import {OrganizationContainer} from 'sentry/views/organizationContainer';
import {useReleasesDrawer} from 'sentry/views/releases/drawer/useReleasesDrawer';

/**
 * Pulled into its own component to avoid re-rendering the OrganizationLayout
 * TODO: figure out why these analytics hooks trigger rerenders
 */
function GlobalAnalytics() {
  useRouteAnalyticsHookSetup();
  useRegisterDomainViewUsage();
  return null;
}

// Org header is for rendering the getsentry banners at the top of the page
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
    <PrimaryNavigationContextProvider>
      <Flex
        flex="1"
        minWidth="0"
        direction={{sm: 'column', md: 'row'}}
        position="relative"
      >
        <Navigation />
        {/* The `#main` selector is used to make the app content `inert` when an overlay is active */}
        <Stack flex="1" minWidth="0" id="main">
          <DemoHeader />
          <AppBodyContent>
            {organization && <OrganizationHeader organization={organization} />}
            {/* Check if organization is in a deleted or pending deletion state and block the route from rendering */}
            {organization?.status?.id === 'pending_deletion' ? (
              <OrganizationDeletionPending organization={organization} />
            ) : organization?.status?.id === 'deletion_in_progress' ? (
              <OrganizationDeletionInProgress organization={organization} />
            ) : (
              <Outlet />
            )}
          </AppBodyContent>
          <Footer />
        </Stack>
      </Flex>
      {organization ? <AppDrawers /> : null}
    </PrimaryNavigationContextProvider>
  );
}

// @TODO(Jonas): Give these pages some creative love, they look very poor and could use a good illustration
interface OrganizationDeletionInProgressProps {
  organization: Organization;
}

function OrganizationDeletionInProgress(props: OrganizationDeletionInProgressProps) {
  return (
    <Layout.Body>
      <Layout.Main>
        <Alert.Container>
          <Alert variant="warning">
            {tct(
              'The [organization] organization is currently in the process of being deleted from Sentry.',
              {
                organization: <strong>{props.organization.slug}</strong>,
              }
            )}
          </Alert>
        </Alert.Container>
      </Layout.Main>
    </Layout.Body>
  );
}

interface OrganizatonDeletionPendingProps {
  organization: Organization;
}

function OrganizationDeletionPending(props: OrganizatonDeletionPendingProps) {
  const api = useApi();

  const {mutate: onRestore, isPending: isRestoring} = useMutation({
    mutationFn: () =>
      api.requestPromise(`/organizations/${props.organization?.slug}/`, {
        method: 'PUT',
        data: {cancelDeletion: true},
      }),
    onSuccess: () => window.location.reload(),
    onError: () => {
      AlertStore.addAlert({
        message:
          'We were unable to restore this organization. Please try again or contact support.',
        variant: 'danger',
      });
    },
  });

  return (
    <Layout.Body>
      <Layout.Main>
        <Heading as="h3">{t('Deletion Scheduled')}</Heading>
        <p>
          {tct('The [organization] organization is currently scheduled for deletion.', {
            organization: <strong>{props.organization.slug}</strong>,
          })}
        </p>

        {props.organization.access.includes('org:admin') ? (
          <div>
            <p>
              {t(
                'Would you like to cancel this process and restore the organization back to the original state?'
              )}
            </p>
            <p>
              <Button
                priority="primary"
                onClick={() => onRestore()}
                disabled={isRestoring}
              >
                {t('Restore Organization')}
              </Button>
            </p>
          </div>
        ) : (
          <p>
            {t(
              'If this is a mistake, contact an organization owner and ask them to restore this organization.'
            )}
          </p>
        )}
        <p>
          <small>
            {t(
              "Note: Restoration is available until the process begins. Once it does, there's no recovering the data that has been removed."
            )}
          </small>
        </p>
      </Layout.Main>
    </Layout.Body>
  );
}
