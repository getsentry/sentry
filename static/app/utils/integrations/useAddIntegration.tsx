import {useCallback, useState} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {MessagingIntegrationAnalyticsView} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
import {openPipelineModal} from 'sentry/components/pipeline/modal';
import type {ProvidersByType} from 'sentry/components/pipeline/registry';
import {t} from 'sentry/locale';
import type {IntegrationProvider, IntegrationWithConfig} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {isScmProvider, trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

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
  onCancel?: () => void;
  onError?: (error: string) => void;
  /**
   * When true, the "%s added" success toast is not shown on install.
   * Use when the surrounding UI already communicates the connected state.
   */
  suppressSuccessMessage?: boolean;
  urlParams?: Record<string, string>;
}

export type AddIntegrationState =
  | {status: 'idle'}
  | {providerKey: string; status: 'installing'}
  | {integration: IntegrationWithConfig; providerKey: string; status: 'complete'}
  | {providerKey: string; status: 'cancelled'; lastError?: string}
  | {error: string; providerKey: string; status: 'error'};

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
  const [state, setState] = useState<AddIntegrationState>({status: 'idle'});

  const startFlow = useCallback((params: AddIntegrationParams) => {
    const {
      organization,
      provider,
      onInstall,
      onCancel,
      onError,
      analyticsParams,
      suppressSuccessMessage,
      urlParams,
      modalParams,
    } = params;

    const is_scm = isScmProvider(provider);
    let cancelled = false;
    let completed = false;
    // Gates analytics only. Deliberately not part of the `onClose` guard below:
    // closing after a failure must still call onCancel so the inline row restores.
    let failureReported = false;
    // Retained so the terminal `cancelled` state can distinguish a failed attempt
    // from a clean back-out.
    let lastError: string | undefined;

    setState({status: 'installing', providerKey: provider.key});

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
        completed = true;
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
        const integration = data as IntegrationWithConfig;
        setState({status: 'complete', providerKey: provider.key, integration});
        onInstall(integration);
      },
      onError: error => {
        setState({status: 'error', providerKey: provider.key, error});
        lastError = error;
        if (!failureReported) {
          failureReported = true;
          trackIntegrationAnalytics('integrations.installation_failed', {
            integration: provider.key,
            integration_type: 'first_party',
            is_scm,
            organization,
            ...analyticsParams,
          });
        }
        onError?.(error);
      },
      onClose: () => {
        if (cancelled || completed) {
          return;
        }
        cancelled = true;
        setState({status: 'cancelled', providerKey: provider.key, lastError});
        if (!failureReported) {
          trackIntegrationAnalytics('integrations.installation_cancelled', {
            integration: provider.key,
            integration_type: 'first_party',
            is_scm,
            organization,
            ...analyticsParams,
          });
        }
        onCancel?.();
      },
    });
  }, []);

  return {startFlow, state};
}
