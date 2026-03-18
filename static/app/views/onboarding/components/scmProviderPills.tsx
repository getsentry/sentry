import {Flex} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

interface ScmProviderPillsProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

export function ScmProviderPills({providers, onInstall}: ScmProviderPillsProps) {
  const organization = useOrganization();

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
          <Access access={['org:integrations']} organization={organization}>
            {({hasAccess}) => (
              <IntegrationButton
                userHasAccess={hasAccess}
                onAddIntegration={onInstall}
                onExternalClick={() => {}}
                buttonProps={{
                  size: 'sm',
                  icon: getIntegrationIcon(provider.key, 'sm'),
                  buttonText: provider.name,
                }}
              />
            )}
          </Access>
        </IntegrationContext>
      ))}
    </Flex>
  );
}
