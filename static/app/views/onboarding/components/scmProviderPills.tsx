import {Flex} from '@sentry/scraps/layout';

import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

interface ScmProviderPillsProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

export function ScmProviderPills({providers, onInstall}: ScmProviderPillsProps) {
  return (
    <Flex gap="md" wrap="wrap" justify="center">
      {providers.map(provider => (
        <IntegrationContext
          key={provider.key}
          value={{
            provider,
            type: 'first_party',
            installStatus: 'Not Installed',
            analyticsParams: {
              view: 'onboarding',
              already_installed: false,
            },
          }}
        >
          <IntegrationButton
            userHasAccess
            onAddIntegration={onInstall}
            onExternalClick={() => {}}
            buttonProps={{
              size: 'sm',
              icon: getIntegrationIcon(provider.key, 'sm'),
              buttonText: provider.name,
            }}
          />
        </IntegrationContext>
      ))}
    </Flex>
  );
}
