import {createContext} from 'react';

import type {IntegrationProvider, IntegrationType} from 'sentry/types/integrations';

export type IntegrationContextProps = {
  analyticsParams: {
    already_installed: boolean;
    view:
      | 'integrations_directory_integration_detail'
      | 'integrations_directory'
      | 'messaging_integration_onboarding'
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
