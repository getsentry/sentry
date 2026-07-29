import {createContext} from 'react';

import type {IntegrationProvider, IntegrationType} from 'sentry/types/integrations';
import type {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

type IntegrationContextProps = {
  analyticsParams: {
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
  installStatus: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  onAddIntegration?: () => void;
  /**
   * When true, the "%s added" success toast is not shown on install.
   * Use when the surrounding UI already communicates the connected state.
   */
  suppressSuccessMessage?: boolean;
};

export const IntegrationContext = createContext<IntegrationContextProps | undefined>(
  undefined
);
