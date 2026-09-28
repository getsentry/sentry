import {motion} from 'framer-motion';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ONBOARDING_ENTER,
  ONBOARDING_STAGGER_CHILDREN,
} from 'sentry/views/onboarding/animations';
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
    <MotionFlex wrap="wrap" justify={justify} gap="md" {...ONBOARDING_STAGGER_CHILDREN}>
      {primaryProviders.map(provider => (
        <MotionContainer key={provider.key} {...ONBOARDING_ENTER}>
          <IntegrationContext
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
                // AddIntegrationButton names every instance "Add integration";
                // name each pill by its provider instead.
                'aria-label': t('Add %s', provider.name),
              }}
            />
          </IntegrationContext>
        </MotionContainer>
      ))}
      {moreProviders.length > 0 && (
        <MotionContainer {...ONBOARDING_ENTER}>
          <DropdownMenu
            triggerLabel={t('More')}
            triggerProps={{'aria-label': t('More providers')}}
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
        </MotionContainer>
      )}
    </MotionFlex>
  );
}

const MotionFlex = motion.create(Flex);
const MotionContainer = motion.create(Container);
