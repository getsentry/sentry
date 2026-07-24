import {Flex, Grid} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {partitionScmProviders} from './scmProviderOrder';

// The install view identifies the host surface. These providers only render in SCM
// flows, so both install paths always set the variant to `scm`.
const INSTALL_VIEW = {
  onboarding: 'onboarding',
  'project-creation': 'project_creation',
} as const;

interface ScmProviderPillsProps {
  analyticsFlow: ScmAnalyticsFlow;
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

export function ScmProviderPills({
  analyticsFlow,
  providers,
  onInstall,
}: ScmProviderPillsProps) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();
  const {primaryProviders, moreProviders} = partitionScmProviders(providers);
  const view = INSTALL_VIEW[analyticsFlow];
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
          'screen:xs': columnsXs,
          'screen:md': columnsMd,
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
                view,
                variant: 'scm',
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
                    view,
                    variant: 'scm',
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
