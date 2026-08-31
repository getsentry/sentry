import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';

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

export function ScmProviderPills(props: ScmProviderPillsProps) {
  return (
    // Declares its own query container: the pills compact and wrap against
    // this wrapper's width when it is tight. The wrapper is capped well below
    // the page-level container scale, so page-relative keys would never fire
    // here. The row is a separate component because it reads this container in
    // JS, and an element can't query itself.
    <Flex justify="start" containerType="inline-size">
      <ScmProviderPillRow {...props} />
    </Flex>
  );
}

function ScmProviderPillRow({
  analyticsFlow,
  providers,
  onInstall,
}: ScmProviderPillsProps) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();
  const {primaryProviders, moreProviders} = partitionScmProviders(providers);
  const view = INSTALL_VIEW[analyticsFlow];

  // When the row is tight the pills compact: the xs button size with matching
  // icons and a tighter gap. Pills that still do not fit wrap to the next line
  // instead of overflowing the container.
  const isCompact = useResponsivePropValue({zero: true, sm: false});
  const buttonSize = isCompact ? 'xs' : 'md';
  const iconSize = isCompact ? 'xs' : 'sm';

  return (
    <Flex wrap="wrap" gap={{zero: 'sm', sm: 'md'}}>
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
              size: buttonSize,
              icon: getIntegrationIcon(provider.key, iconSize),
              buttonText: provider.name,
            }}
          />
        </IntegrationContext>
      ))}
      {moreProviders.length > 0 && (
        <DropdownMenu
          triggerLabel={t('More')}
          position="bottom-end"
          size={buttonSize}
          items={moreProviders.map(provider => ({
            key: provider.key,
            label: provider.name,
            leadingItems: getIntegrationIcon(provider.key, iconSize),
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
    </Flex>
  );
}
