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
 * Provider keys shown as top-level pill buttons, in display order.
 * Everything else is grouped into the "More" dropdown.
 */
const PRIMARY_PROVIDER_KEYS: readonly string[] = ['github', 'gitlab', 'bitbucket'];

interface ScmProviderPillsProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

export function ScmProviderPills({providers, onInstall}: ScmProviderPillsProps) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();
  const primaryProviders = PRIMARY_PROVIDER_KEYS.map(key =>
    providers.find(p => p.key === key)
  ).filter((p): p is IntegrationProvider => p !== undefined);
  const moreProviders = providers.filter(p => !PRIMARY_PROVIDER_KEYS.includes(p.key));
  const gridItemCount = primaryProviders.length + (moreProviders.length > 0 ? 1 : 0);

  const columnsXs = `repeat(${Math.min(gridItemCount, 2)}, 1fr)`;
  const columnsMd = [
    primaryProviders.length && `repeat(${primaryProviders.length}, 1fr)`,
    moreProviders.length && 'min-content',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Flex justify="start">
      <Grid
        columns={{
          xs: columnsXs,
          md: columnsMd,
        }}
        justify="center"
        gap="md"
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
