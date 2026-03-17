import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import Access from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

interface ProviderPillsProps {
  integrationsByProviderKey: Map<string, Integration>;
  onInstall: (data: Integration) => void;
  onSelect: (installation: Integration) => void;
  providers: IntegrationProvider[];
}

export function ProviderPills({
  providers,
  integrationsByProviderKey,
  onInstall,
  onSelect,
}: ProviderPillsProps) {
  const organization = useOrganization();
  const hasExistingIntegrations = integrationsByProviderKey.size > 0;

  return (
    <Flex direction="column" align="center" gap="md">
      <Flex gap="md" wrap="wrap" justify="center">
        {providers.map(provider => {
          const installation = integrationsByProviderKey.get(provider.key);

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

          // If other integrations already exist, don't show OAuth buttons for
          // unconnected providers. The PRD directs users to Settings > Integrations
          // for connecting additional providers (scenarios D, E).
          if (hasExistingIntegrations) {
            return null;
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
      {hasExistingIntegrations && (
        <Text size="sm" variant="muted">
          {t('Need a different provider? ')}
          <Link to={normalizeUrl(`/settings/${organization.slug}/integrations/`)}>
            {t('Manage in Settings')}
          </Link>
        </Text>
      )}
    </Flex>
  );
}
