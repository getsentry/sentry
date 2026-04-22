import {useCallback, useEffect, useRef} from 'react';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openPipelineModal} from 'sentry/components/pipeline/modal';
import type {ProvidersByType} from 'sentry/components/pipeline/registry';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {IntegrationProvider, IntegrationWithConfig} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {isScmProvider, trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {computeCenteredWindow} from 'sentry/utils/window/computeCenteredWindow';
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
      | 'onboarding_scm'
      | 'project_creation'
      | 'seer_onboarding_github'
      | 'seer_onboarding_code_review'
      | 'test_analytics_onboarding'
      | 'test_analytics_org_selector';
  };
  modalParams?: Record<string, string>;
  /**
   * When true, the "%s added" success toast is not shown on install.
   * Use when the surrounding UI already communicates the connected state.
   */
  suppressSuccessMessage?: boolean;
  urlParams?: Record<string, string>;
}

/**
 * Providers that should always use the API-driven pipeline modal.
 */
const UNCONDITIONAL_API_PIPELINE_PROVIDERS = [
  'aws_lambda',
  'bitbucket',
  'claude_code',
  'cursor',
  'discord',
  'github',
  'gitlab',
  'opsgenie',
  'pagerduty',
  'slack',
  'slack_staging',
  'vsts',
] as const satisfies ReadonlyArray<ProvidersByType['integration']>;

type UnconditionalApiPipelineProvider =
  (typeof UNCONDITIONAL_API_PIPELINE_PROVIDERS)[number];

/**
 * Providers that support the API-driven pipeline modal but still require an
 * organization feature flag during rollout.
 *
 * Keys are provider identifiers, values are feature flag names without the
 * `organizations:` prefix.
 */
const API_PIPELINE_FEATURE_FLAGS = {} as const satisfies Partial<
  Record<ProvidersByType['integration'], string>
>;

type FlaggedApiPipelineProvider = keyof typeof API_PIPELINE_FEATURE_FLAGS;
type ApiPipelineProvider = UnconditionalApiPipelineProvider | FlaggedApiPipelineProvider;

function getApiPipelineProvider(
  organization: Organization,
  providerKey: string
): ApiPipelineProvider | null {
  if (
    UNCONDITIONAL_API_PIPELINE_PROVIDERS.includes(
      providerKey as UnconditionalApiPipelineProvider
    )
  ) {
    return providerKey as UnconditionalApiPipelineProvider;
  }

  if (providerKey in API_PIPELINE_FEATURE_FLAGS) {
    const key = providerKey as keyof typeof API_PIPELINE_FEATURE_FLAGS;
    if (organization.features.includes(API_PIPELINE_FEATURE_FLAGS[key])) {
      return key;
    }
  }

  return null;
}

/**
 * Opens the integration setup flow. Accepts all parameters at call time via
 * `startFlow(params)`, so a single hook instance can launch flows for any
 * provider. Automatically selects between the API-driven pipeline modal and
 * the legacy popup-based flow based on the provider's rollout state.
 *
 * The hook manages its own `message` event listener for the legacy popup flow.
 * No context provider is needed.
 */
export function useAddIntegration() {
  const dialogRef = useRef<Window | null>(null);
  const activeProviderRef = useRef<IntegrationProvider | null>(null);
  const organizationRef = useRef<Organization | null>(null);
  const onInstallRef = useRef<((data: IntegrationWithConfig) => void) | null>(null);
  const analyticsParamsRef = useRef<AddIntegrationParams['analyticsParams']>(undefined);
  const suppressSuccessMessageRef = useRef<boolean>(false);

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

      if (activeProviderRef.current && organizationRef.current) {
        trackIntegrationAnalytics('integrations.installation_complete', {
          integration: activeProviderRef.current.key,
          integration_type: 'first_party',
          is_scm: isScmProvider(activeProviderRef.current),
          organization: organizationRef.current,
          ...analyticsParamsRef.current,
        });
        if (!suppressSuccessMessageRef.current) {
          addSuccessMessage(t('%s added', activeProviderRef.current.name));
        }
      }
      onInstallRef.current?.(data);
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      dialogRef.current?.close();
    };
  }, []);

  const startFlow = useCallback((params: AddIntegrationParams) => {
    const {
      organization,
      provider,
      onInstall,
      account,
      analyticsParams,
      modalParams,
      suppressSuccessMessage,
      urlParams,
    } = params;

    // Store in refs for the message handler
    activeProviderRef.current = provider;
    organizationRef.current = organization;
    onInstallRef.current = onInstall;
    analyticsParamsRef.current = analyticsParams;
    suppressSuccessMessageRef.current = !!suppressSuccessMessage;

    const pipelineProvider = getApiPipelineProvider(organization, provider.key);

    const is_scm = isScmProvider(provider);

    if (pipelineProvider !== null) {
      trackIntegrationAnalytics('integrations.installation_start', {
        integration: provider.key,
        integration_type: 'first_party',
        is_scm,
        organization,
        ...analyticsParams,
      });
      openPipelineModal({
        type: 'integration',
        provider: pipelineProvider,
        initialData: urlParams,
        onComplete: (data: IntegrationWithConfig) => {
          trackIntegrationAnalytics('integrations.installation_complete', {
            integration: provider.key,
            integration_type: 'first_party',
            is_scm,
            organization,
            ...analyticsParams,
          });
          if (!suppressSuccessMessage) {
            addSuccessMessage(t('%s added', provider.name));
          }
          onInstall(data);
        },
      });
      return;
    }

    // Legacy popup flow
    trackIntegrationAnalytics('integrations.installation_start', {
      integration: provider.key,
      integration_type: 'first_party',
      is_scm,
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
  }, []);

  return {startFlow};
}
