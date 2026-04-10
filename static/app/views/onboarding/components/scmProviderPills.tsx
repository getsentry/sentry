import {Flex, Grid} from '@sentry/scraps/layout';

import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import {ScmProvidersDropdown} from './scmProvidersDropdown';

/**
 * Provider keys shown as top-level pill buttons. Everything else is grouped
 * into the "More" dropdown to reduce visual clutter.
 */
const PRIMARY_PROVIDER_KEYS = new Set(['github', 'gitlab', 'bitbucket']);

interface ScmProviderPillsProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

export function ScmProviderPills({providers, onInstall}: ScmProviderPillsProps) {
  const primaryProviders = providers.filter(p => PRIMARY_PROVIDER_KEYS.has(p.key));
  const moreProviders = providers.filter(p => !PRIMARY_PROVIDER_KEYS.has(p.key));

  return (
    <Flex justify="center">
      <Grid
        columns={{
          xs: '1fr 1fr',
          md: primaryProviders.length
            ? `repeat(${primaryProviders.length}, 1fr) min-content`
            : 'min-content',
        }}
        rows={{xs: 2}}
        justify="center"
        gap="lg"
      >
        {primaryProviders.map(provider => (
          <IntegrationContext
            key={provider.key}
            value={{
              provider,
              type: 'first_party',
              installStatus: 'Not Installed',
              analyticsParams: {
                view: 'onboarding_scm',
                already_installed: false,
              },
            }}
          >
            <IntegrationButton
              userHasAccess
              onAddIntegration={onInstall}
              onExternalClick={() => {}}
              buttonProps={{
                icon: getIntegrationIcon(provider.key, 'sm'),
                buttonText: provider.name,
              }}
            />
          </IntegrationContext>
        ))}
        {moreProviders.length > 0 && (
          <ScmProvidersDropdown providers={moreProviders} onInstall={onInstall} />
        )}
      </Grid>
    </Flex>
  );
}
