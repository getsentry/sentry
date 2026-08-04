import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openPipelineModal} from 'sentry/components/pipeline/modal';
import type {ProvidersByType} from 'sentry/components/pipeline/registry';
import {t} from 'sentry/locale';
import type {IntegrationProvider, IntegrationWithConfig} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {isScmProvider, trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import type {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

export interface AddIntegrationParams {
  onInstall: (data: IntegrationWithConfig) => void;
  organization: Organization;
  provider: IntegrationProvider;
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
    referrer?: string;
    // Keep the experience variant separate from the flow-specific view value.
    variant?: 'scm' | 'legacy';
  };
  /**
   * Overrides for the install modal's copy. Passed straight through to
   * `openPipelineModal`; this hook does not read them.
   */
  modalParams?: {
    description?: string;
    title?: string;
  };
  /**
   * When true, the "%s added" success toast is not shown on install.
   * Use when the surrounding UI already communicates the connected state.
   */
  suppressSuccessMessage?: boolean;
  urlParams?: Record<string, string>;
}

/**
 * Opens the integration setup flow. Accepts all parameters at call time via
 * `startFlow(params)`, so a single hook instance can launch flows for any
 * provider.
 *
 * Every first-party provider is API-driven: `startFlow` resolves the provider
 * to its registered pipeline and opens the API-driven pipeline modal. Invalid
 * flows are surfaced by `openPipelineModal`/the registry.
 */
export function useAddIntegration() {
  const startFlow = useCallback((params: AddIntegrationParams) => {
    const {
      organization,
      provider,
      onInstall,
      analyticsParams,
      suppressSuccessMessage,
      urlParams,
      modalParams,
    } = params;

    const is_scm = isScmProvider(provider);

    trackIntegrationAnalytics('integrations.installation_start', {
      integration: provider.key,
      integration_type: 'first_party',
      is_scm,
      organization,
      ...analyticsParams,
    });

    openPipelineModal({
      type: 'integration',
      provider: provider.key as ProvidersByType['integration'],
      initialData: urlParams,
      ...modalParams,
      onComplete: data => {
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
        onInstall(data as IntegrationWithConfig);
      },
    });
  }, []);

  return {startFlow};
}
