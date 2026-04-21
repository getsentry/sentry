import {Flex, Grid} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

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
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();
  const primaryProviders = providers.filter(p => PRIMARY_PROVIDER_KEYS.has(p.key));
  const moreProviders = providers.filter(p => !PRIMARY_PROVIDER_KEYS.has(p.key));
  const gridItemCount = primaryProviders.length + (moreProviders.length > 0 ? 1 : 0);

  const columnsXs = `repeat(${Math.min(gridItemCount, 2)}, 1fr)`;
  const columnsMd = [
    primaryProviders.length && `repeat(${primaryProviders.length}, 1fr)`,
    moreProviders.length && 'min-content',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Flex justify="center">
      <Grid
        columns={{
          xs: columnsXs,
          md: columnsMd,
        }}
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
              suppressSuccessMessage: true,
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
          <DropdownMenu
            triggerLabel={t('More')}
            position="bottom-end"
            items={moreProviders.map(provider => ({
              key: provider.key,
              label: provider.name,
              leadingItems: getIntegrationIcon(provider.key, 'sm'),
              onAction: () =>
                startFlow({
                  provider,
                  organization,
                  onInstall,
                  analyticsParams: {
                    view: 'onboarding_scm',
                    already_installed: false,
                  },
                  suppressSuccessMessage: true,
                }),
            }))}
          />
        )}
      </Grid>
    </Flex>
  );
}
