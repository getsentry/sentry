import {lazy, Suspense, useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {
  displayDeployPreviewAlert,
  displayExperimentalSpaAlert,
} from 'sentry/actionCreators/developmentAlerts';
import {fetchGuides} from 'sentry/actionCreators/guides';
import {openCommandPalette} from 'sentry/actionCreators/modal';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {initApiClientErrorHandling} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {GlobalDrawer} from 'sentry/components/globalDrawer';
import GlobalModal from 'sentry/components/globalModal';
import Hook from 'sentry/components/hook';
import Indicators from 'sentry/components/indicators';
import {DEPLOY_PREVIEW_CONFIG, EXPERIMENTAL_SPA} from 'sentry/constants';
import AlertStore from 'sentry/stores/alertStore';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import HookStore from 'sentry/stores/hookStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import isValidOrgSlug from 'sentry/utils/isValidOrgSlug';
import {onRenderCallback, Profiler} from 'sentry/utils/performanceForSentry';
import useApi from 'sentry/utils/useApi';
import {useColorscheme} from 'sentry/utils/useColorscheme';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useUser} from 'sentry/utils/useUser';
import type {InstallWizardProps} from 'sentry/views/admin/installWizard';
import {AsyncSDKIntegrationContextProvider} from 'sentry/views/app/asyncSDKIntegrationProvider';
import LastKnownRouteContextProvider from 'sentry/views/lastKnownRouteContextProvider';
import {OrganizationContextProvider} from 'sentry/views/organizationContext';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

import {DEMO_HEADER_HEIGHT_PX} from '../../components/demo/demoHeader';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{orgId?: string}>;

const InstallWizard = lazy(
  () => import('sentry/views/admin/installWizard')
  // TODO(TS): DeprecatedAsyncComponent prop types are doing something weird
) as unknown as React.ComponentType<InstallWizardProps>;
const NewsletterConsent = lazy(() => import('sentry/views/newsletterConsent'));
const BeaconConsent = lazy(() => import('sentry/views/beaconConsent'));

/**
 * App is the root level container for all uathenticated routes.
 */
function App({children, params}: Props) {
  useColorscheme();

  const api = useApi();
  const user = useUser();
  const config = useLegacyStore(ConfigStore);

  // Command palette global-shortcut
  const commandPaletteHotkeys = useMemo(() => {
    return {
      match: ['command+shift+p', 'command+k', 'ctrl+shift+p', 'ctrl+k'],
      includeInputs: true,
      callback: () => openCommandPalette(),
    };
  }, []);

  useHotkeys([commandPaletteHotkeys]);

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
      const type = problem.severity === 'critical' ? 'error' : 'warning';

      AlertStore.addAlert({id, message, type, url, opaque: true});
    });
  }, [api, config.isSelfHosted]);

  const {sentryUrl} = ConfigStore.get('links');
  const {orgId} = params;
  const isOrgSlugValid = orgId ? isValidOrgSlug(orgId) : true;

  useEffect(() => {
    if (orgId === undefined) {
      return;
    }

    if (!isOrgSlugValid) {
      window.location.replace(sentryUrl);
      return;
    }
  }, [orgId, sentryUrl, isOrgSlugValid]);

  // Update guide store on location change
  const location = useLocation();
  useEffect(() => GuideStore.onURLChange(), [location]);

  useEffect(() => {
    // Skip loading organization-related data before the user is logged in,
    // because it triggers a 401 error in the UI.
    if (!config.shouldPreloadData) {
      return undefined;
    }

    loadOrganizations();
    checkInternalHealth();

    // Show system-level alerts
    config.messages.forEach(msg =>
      AlertStore.addAlert({message: msg.message, type: msg.level, neverExpire: true})
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
  }, [
    loadOrganizations,
    checkInternalHealth,
    config.messages,
    user,
    config.shouldPreloadData,
  ]);

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

    return children;
  }

  const renderOrganizationContextProvider = useCallback(
    (content: React.ReactNode) => {
      // Skip loading organization-related data before the user is logged in,
      // because it triggers a 401 error in the UI.
      if (!config.shouldPreloadData) {
        return content;
      }
      return <OrganizationContextProvider>{content}</OrganizationContextProvider>;
    },
    [config.shouldPreloadData]
  );

  // Used to restore focus to the container after closing the modal
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const handleModalClose = useCallback(() => mainContainerRef.current?.focus?.(), []);

  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <LastKnownRouteContextProvider>
        <RouteAnalyticsContextProvider>
          {renderOrganizationContextProvider(
            <AsyncSDKIntegrationContextProvider>
              <GlobalFeedbackForm>
                <GlobalDrawer>
                  <MainContainer tabIndex={-1} ref={mainContainerRef}>
                    <GlobalModal onClose={handleModalClose} />
                    <Indicators className="indicators-container" />
                    <ErrorBoundary>{renderBody()}</ErrorBoundary>
                  </MainContainer>
                </GlobalDrawer>
              </GlobalFeedbackForm>
            </AsyncSDKIntegrationContextProvider>
          )}
        </RouteAnalyticsContextProvider>
      </LastKnownRouteContextProvider>
    </Profiler>
  );
}

export default App;

const MainContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  outline: none;
  padding-top: ${() => (isDemoModeEnabled() ? DEMO_HEADER_HEIGHT_PX : 0)};
`;
