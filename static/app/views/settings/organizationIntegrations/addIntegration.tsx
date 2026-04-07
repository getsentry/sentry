import {useCallback, useEffect, useRef} from 'react';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openPipelineModal} from 'sentry/components/pipeline/modal';
import type {ProvidersByType} from 'sentry/components/pipeline/registry';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {IntegrationProvider, IntegrationWithConfig} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import type {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

export interface AddIntegrationParams {
  onInstall: (data: IntegrationWithConfig) => void;
  organization: Organization;
  provider: IntegrationProvider;
  account?: string | null;
  analyticsParams?: {
    already_installed: boolean;
    view:
      | MessagingIntegrationAnalyticsView
      | 'integrations_directory_integration_detail'
      | 'integrations_directory'
      | 'onboarding'
      | 'project_creation'
      | 'seer_onboarding_github'
      | 'seer_onboarding_code_review'
      | 'test_analytics_onboarding'
      | 'test_analytics_org_selector';
  };
  modalParams?: Record<string, string>;
}

/**
 * Per-provider feature flags that gate the new API-driven pipeline setup flow.
 * When enabled for a provider, the integration setup uses the React pipeline
 * modal instead of the legacy Django view popup window.
 *
 * Keys are provider identifiers (constrained to registered pipeline providers
 * via `satisfies`), values are feature flag names without the `organizations:`
 * prefix.
 */
const API_PIPELINE_FEATURE_FLAGS = {
  github: 'integration-api-pipeline-github',
} as const satisfies Partial<Record<ProvidersByType['integration'], string>>;

type ApiPipelineProvider = keyof typeof API_PIPELINE_FEATURE_FLAGS;

function getApiPipelineProvider(
  organization: Organization,
  providerKey: string
): ApiPipelineProvider | null {
  if (!(providerKey in API_PIPELINE_FEATURE_FLAGS)) {
    return null;
  }
  const key = providerKey as ApiPipelineProvider;
  const flag = API_PIPELINE_FEATURE_FLAGS[key];
  if (!organization.features.includes(flag)) {
    return null;
  }
  return key;
}

function computeCenteredWindow(width: number, height: number) {
  const screenLeft = window.screenLeft === undefined ? window.screenX : window.screenLeft;
  const screenTop = window.screenTop === undefined ? window.screenY : window.screenTop;

  const innerWidth = window.innerWidth
    ? window.innerWidth
    : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width;

  const innerHeight = window.innerHeight
    ? window.innerHeight
    : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height;

  const left = innerWidth / 2 - width / 2 + screenLeft;
  const top = innerHeight / 2 - height / 2 + screenTop;

  return {left, top};
}

/**
 * Opens the legacy Django-driven integration setup flow in a popup window and
 * listens for a `postMessage` callback on completion.
 *
 * Used  for integrations that have not been migrated to the API pipeline system.
 */
function useLegacyAddIntegration({
  provider,
  organization,
  onInstall,
  account,
  analyticsParams,
  modalParams,
}: AddIntegrationParams) {
  const dialogRef = useRef<Window | null>(null);
  const onInstallRef = useRef(onInstall);
  onInstallRef.current = onInstall;
  const analyticsParamsRef = useRef(analyticsParams);
  analyticsParamsRef.current = analyticsParams;

  useEffect(() => {
    function handleMessage(message: MessageEvent) {
      const validOrigins = [
        ConfigStore.get('links').sentryUrl,
        ConfigStore.get('links').organizationUrl,
        document.location.origin,
      ];
      if (!validOrigins.includes(message.origin)) {
        return;
      }
      if (message.source !== dialogRef.current) {
        return;
      }

      const {success, data} = message.data;
      dialogRef.current = null;

      if (!success) {
        addErrorMessage(data?.error ?? t('An unknown error occurred'));
        return;
      }
      if (!data) {
        return;
      }

      trackIntegrationAnalytics('integrations.installation_complete', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParamsRef.current,
      });
      addSuccessMessage(t('%s added', provider.name));
      onInstallRef.current(data);
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      dialogRef.current?.close();
    };
  }, [provider.key, provider.name, organization]);

  const startFlow = useCallback(
    (urlParams?: Record<string, string>) => {
      trackIntegrationAnalytics('integrations.installation_start', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams,
      });

      const name = modalParams?.use_staging
        ? 'sentryAddStagingIntegration'
        : 'sentryAddIntegration';
      const {url, width, height} = provider.setupDialog;
      const {left, top} = computeCenteredWindow(width, height);

      let query: Record<string, string> = {...urlParams};
      if (account) {
        query.account = account;
      }
      if (modalParams) {
        query = {...query, ...modalParams};
      }

      const installUrl = `${url}?${qs.stringify(query)}`;
      const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

      dialogRef.current = window.open(installUrl, name, opts);
      dialogRef.current?.focus();
    },
    [provider, organization, account, analyticsParams, modalParams]
  );

  return {startFlow};
}

/**
 * Opens the integration setup flow. Automatically selects between the new
 * API-driven pipeline modal and the legacy popup-based flow depending on
 * the organization's feature flags.
 */
export function useAddIntegration(params: AddIntegrationParams) {
  const {provider, organization, onInstall} = params;
  const {startFlow: legacyStartFlow} = useLegacyAddIntegration(params);
  const pipelineProvider = getApiPipelineProvider(organization, provider.key);

  const startFlow = useCallback(
    (urlParams?: Record<string, string>) => {
      // Fallback to legacy view-based flow when the feature flag for API based
      // flows is not enabled for the provider.
      if (pipelineProvider === null) {
        legacyStartFlow(urlParams);
        return;
      }

      trackIntegrationAnalytics('integrations.installation_start', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...params.analyticsParams,
      });
      openPipelineModal({
        type: 'integration',
        provider: pipelineProvider,
        onComplete: (data: IntegrationWithConfig) => {
          trackIntegrationAnalytics('integrations.installation_complete', {
            integration: provider.key,
            integration_type: 'first_party',
            organization,
            ...params.analyticsParams,
          });
          addSuccessMessage(t('%s added', provider.name));
          onInstall(data);
        },
      });
    },
    [
      pipelineProvider,
      provider,
      organization,
      params.analyticsParams,
      onInstall,
      legacyStartFlow,
    ]
  );

  return {startFlow};
}
