import {lazy, Suspense, useCallback, useEffect, useRef} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {
  displayDeployPreviewAlert,
  displayExperimentalSpaAlert,
} from 'sentry/actionCreators/developmentAlerts';
import {fetchGuides} from 'sentry/actionCreators/guides';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {initApiClientErrorHandling} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import GlobalModal from 'sentry/components/globalModal';
import Hook from 'sentry/components/hook';
import Indicators from 'sentry/components/indicators';
import {UserTimezoneProvider} from 'sentry/components/timezoneProvider';
import {DEPLOY_PREVIEW_CONFIG, EXPERIMENTAL_SPA} from 'sentry/constants';
import AlertStore from 'sentry/stores/alertStore';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import HookStore from 'sentry/stores/hookStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {DemoToursProvider} from 'sentry/utils/demoMode/demoTours';
import isValidOrgSlug from 'sentry/utils/isValidOrgSlug';
import {onRenderCallback, Profiler} from 'sentry/utils/performanceForSentry';
import {shouldPreloadData} from 'sentry/utils/shouldPreloadData';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useColorscheme} from 'sentry/utils/useColorscheme';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {AsyncSDKIntegrationContextProvider} from 'sentry/views/app/asyncSDKIntegrationProvider';
import LastKnownRouteContextProvider from 'sentry/views/lastKnownRouteContextProvider';
import {OrganizationContextProvider} from 'sentry/views/organizationContext';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';
import ExplorerPanel from 'sentry/views/seerExplorer/explorerPanel';
import {ExplorerPanelProvider} from 'sentry/views/seerExplorer/useExplorerPanel';

const InstallWizard = lazy(() => import('sentry/views/admin/installWizard'));
const NewsletterConsent = lazy(() => import('sentry/views/newsletterConsent'));
const BeaconConsent = lazy(() => import('sentry/views/beaconConsent'));

/**
 * App is the root level container for all uathenticated routes.
 */
function App() {
  useColorscheme();

  const api = useApi();
  const user = useUser();
  const config = useLegacyStore(ConfigStore);
  const preloadData = shouldPreloadData(config);

  /**
   * Loads the users organization list into the OrganizationsStore
   */
  const loadOrganizations = useCallback(async () => {
    try {
      const data = await fetchOrganizations(api, {member: '1'});
      OrganizationsStore.load(data);
    } catch {
      // TODO: do something?
    }
  }, [api]);

  /**
   * Creates Alerts for any internal health problems
   */
  const checkInternalHealth = useCallback(async () => {
    // For saas deployments we have more robust ways of checking application health.
    if (!config.isSelfHosted) {
      return;
    }
    let data: any = null;

    try {
      data = await api.requestPromise('/internal/health/');
    } catch {
      // TODO: do something?
    }

    data?.problems?.forEach?.((problem: any) => {
      const {id, message, url} = problem;
      const variant = problem.severity === 'critical' ? 'danger' : 'warning';

      AlertStore.addAlert({id, message, variant, url, opaque: true});
    });
  }, [api, config.isSelfHosted]);

  const {sentryUrl} = ConfigStore.get('links');
  const {orgId} = useParams<{orgId?: string}>();
  const isOrgSlugValid = orgId ? isValidOrgSlug(orgId) : true;

  useEffect(() => {
    if (orgId === undefined) {
      return;
    }

    if (!isOrgSlugValid) {
      testableWindowLocation.replace(sentryUrl);
      return;
    }
  }, [orgId, sentryUrl, isOrgSlugValid]);

  // Update guide store on location change
  const location = useLocation();
  useEffect(() => GuideStore.onURLChange(), [location]);

  useEffect(() => {
    // Skip loading organization-related data before the user is logged in,
    // because it triggers a 401 error in the UI.
    if (!preloadData) {
      return undefined;
    }

    loadOrganizations();
    checkInternalHealth();

    // Show system-level alerts that were forwarded by the initial client config request
    config.messages.forEach(msg =>
      AlertStore.addAlert({
        message: msg.message,
        variant:
          // These are django message level tags that need to be mapped to our alert variant types.
          // See client config in ./src/sentry/web/client_config.py
          msg.level === 'error' ? 'danger' : msg.level === 'debug' ? 'muted' : msg.level,
        neverExpire: true,
      })
    );

    // The app is running in deploy preview mode
    if (DEPLOY_PREVIEW_CONFIG) {
      displayDeployPreviewAlert();
    }

    // The app is running in local SPA mode
    if (!DEPLOY_PREVIEW_CONFIG && EXPERIMENTAL_SPA) {
      displayExperimentalSpaAlert();
    }

    // Set the user for analytics
    if (user) {
      HookStore.get('analytics:init-user').map(cb => cb(user));
    }

    initApiClientErrorHandling();
    fetchGuides();

    // When the app is unloaded clear the organizationst list
    return () => OrganizationsStore.load([]);
  }, [loadOrganizations, checkInternalHealth, config.messages, user, preloadData]);

  function clearUpgrade() {
    ConfigStore.set('needsUpgrade', false);
  }

  function clearNewsletterConsent() {
    const flags = {...user.flags, newsletter_consent_prompt: false};
    ConfigStore.set('user', {...user, flags});
  }

  function clearBeaconConsentPrompt() {
    ConfigStore.set('shouldShowBeaconConsentPrompt', false);
  }

  const displayInstallWizard =
    user?.isSuperuser && config.needsUpgrade && config.isSelfHosted;
  const newsletterConsentPrompt = user?.flags?.newsletter_consent_prompt;
  const partnershipAgreementPrompt = config.partnershipAgreementPrompt;
  const beaconConsentPrompt =
    user?.isSuperuser && config.isSelfHosted && config.shouldShowBeaconConsentPrompt;

  function renderBody() {
    if (displayInstallWizard) {
      return (
        <Suspense fallback={null}>
          <InstallWizard onConfigured={clearUpgrade} />
        </Suspense>
      );
    }

    if (beaconConsentPrompt) {
      return (
        <Suspense fallback={null}>
          <BeaconConsent onSubmitSuccess={clearBeaconConsentPrompt} />
        </Suspense>
      );
    }

    if (partnershipAgreementPrompt) {
      return (
        <Suspense fallback={null}>
          <Hook
            name="component:partnership-agreement"
            partnerDisplayName={partnershipAgreementPrompt.partnerDisplayName}
            agreements={partnershipAgreementPrompt.agreements}
            onSubmitSuccess={() => ConfigStore.set('partnershipAgreementPrompt', null)}
            organizationSlug={config.customerDomain?.subdomain}
          />
        </Suspense>
      );
    }

    if (newsletterConsentPrompt) {
      return (
        <Suspense fallback={null}>
          <NewsletterConsent onSubmitSuccess={clearNewsletterConsent} />
        </Suspense>
      );
    }

    if (!isOrgSlugValid) {
      return null;
    }

    return <Outlet />;
  }

  const renderOrganizationContextProvider = useCallback(
    (content: React.ReactNode) => {
      // Skip loading organization-related data before the user is logged in,
      // because it triggers a 401 error in the UI.
      if (!preloadData) {
        return content;
      }
      return <OrganizationContextProvider>{content}</OrganizationContextProvider>;
    },
    [preloadData]
  );

  // Used to restore focus to the container after closing the modal
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const handleModalClose = useCallback(() => mainContainerRef.current?.focus?.(), []);

  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <UserTimezoneProvider>
        <LastKnownRouteContextProvider>
          <RouteAnalyticsContextProvider>
            {renderOrganizationContextProvider(
              <AsyncSDKIntegrationContextProvider>
                <GlobalFeedbackForm>
                  <MainContainer tabIndex={-1} ref={mainContainerRef}>
                    <DemoToursProvider>
                      <ExplorerPanelProvider>
                        <GlobalModal onClose={handleModalClose} />
                        <ExplorerPanel />
                        <Indicators className="indicators-container" />
                        <ErrorBoundary>{renderBody()}</ErrorBoundary>
                      </ExplorerPanelProvider>
                    </DemoToursProvider>
                  </MainContainer>
                </GlobalFeedbackForm>
              </AsyncSDKIntegrationContextProvider>
            )}
          </RouteAnalyticsContextProvider>
        </LastKnownRouteContextProvider>
      </UserTimezoneProvider>
    </Profiler>
  );
}

export default App;

const MainContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  outline: none;
`;
