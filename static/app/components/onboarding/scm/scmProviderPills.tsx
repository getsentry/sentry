import {Flex, type FlexProps} from '@sentry/scraps/layout';

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
  // Horizontal alignment of the pill row. Left by default; hosts that center
  // their layout (the onboarding connect step) pass `center`.
  justify?: FlexProps['justify'];
}

export function ScmProviderPills({justify = 'start', ...props}: ScmProviderPillsProps) {
  return (
    // Declares its own query container: pills that do not fit this wrapper's
    // width wrap to the next line instead of overflowing it.
    <Flex justify={justify} containerType="inline-size">
      <ScmProviderPillRow justify={justify} {...props} />
    </Flex>
  );
}

function ScmProviderPillRow({
  analyticsFlow,
  providers,
  onInstall,
  justify,
}: ScmProviderPillsProps) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();
  const {primaryProviders, moreProviders} = partitionScmProviders(providers);
  const view = INSTALL_VIEW[analyticsFlow];
  const buttonSize = 'md';
  const iconSize = 'sm';

  return (
    <Flex wrap="wrap" justify={justify} gap="md">
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
