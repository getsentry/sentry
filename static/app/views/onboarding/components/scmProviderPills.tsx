import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

interface ProviderPillsProps {
  integrations: Integration[];
  onInstall: (data: Integration) => void;
  onSelect: (installation: Integration) => void;
  providers: IntegrationProvider[];
}

export function ProviderPills({
  providers,
  integrations,
  onInstall,
  onSelect,
}: ProviderPillsProps) {
  const organization = useOrganization();

  return (
    <Flex gap="md" wrap="wrap" justify="center">
      {providers.map(provider => {
        const installation = integrations.find(i => i.provider.key === provider.key);

        if (installation) {
          return (
            <Button
              key={provider.key}
              size="sm"
              icon={getIntegrationIcon(provider.key, 'sm')}
              onClick={() => onSelect(installation)}
            >
              {provider.name}
            </Button>
          );
        }

        return (
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
        );
      })}
    </Flex>
  );
}
