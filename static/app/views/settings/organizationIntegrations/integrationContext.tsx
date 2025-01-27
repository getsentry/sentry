import {createContext} from 'react';

import type {IntegrationProvider, IntegrationType} from 'sentry/types/integrations';
import type {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

export type IntegrationContextProps = {
  analyticsParams: {
    already_installed: boolean;
    view:
      | MessagingIntegrationAnalyticsView
      | 'integrations_directory_integration_detail'
      | 'integrations_directory'
      | 'onboarding'
      | 'project_creation';
    referrer?: string;
  };
  installStatus: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  modalParams?: {[key: string]: string};
  onAddIntegration?: () => void;
};

export const IntegrationContext = createContext<IntegrationContextProps | undefined>(
  undefined
);
