import {motion} from 'framer-motion';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {OpenPipelineModalOptions} from 'sentry/components/pipeline/modal';
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

// The install analytics for each host surface. The view identifies the surface. In
// onboarding and project creation these providers only render in the SCM variant, so
// their installs always set the variant to `scm`. The Seer chat has no variants. Its connect
// modal records installs apart when a link (the one in a member's request email) opened it.
const INSTALL_ANALYTICS = {
  onboarding: {view: 'onboarding', variant: 'scm'},
  'project-creation': {view: 'project_creation', variant: 'scm'},
  'seer-explorer': {view: 'seer_explorer_connect_scm'},
  'seer-explorer-link': {view: 'seer_explorer_connect_scm_link'},
} as const;

interface ScmProviderPillsProps {
  analyticsFlow: ScmAnalyticsFlow | 'seer-explorer' | 'seer-explorer-link';
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
  // Horizontal alignment of the pill row. Left by default; hosts that center
  // their layout (the onboarding connect step) pass `center`.
  justify?: FlexProps['justify'];
  // Opens the install flow in place of a modal of its own. For hosts that are
  // already a modal, which a second modal would replace.
  openInstallPipeline?: (options: OpenPipelineModalOptions<'integration'>) => void;
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
  openInstallPipeline,
}: ScmProviderPillsProps) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();
  const {primaryProviders, moreProviders} = partitionScmProviders(providers);
  const analyticsParams = {...INSTALL_ANALYTICS[analyticsFlow], already_installed: false};
  const buttonSize = 'md';
  const iconSize = 'sm';
  const modalParams = openInstallPipeline
    ? {openPipeline: openInstallPipeline}
    : undefined;

  return (
    <MotionFlex wrap="wrap" justify={justify} gap="md" {...ONBOARDING_STAGGER_CHILDREN}>
      {primaryProviders.map(provider => (
        <MotionContainer key={provider.key} {...ONBOARDING_ENTER}>
          <IntegrationContext
            value={{
              provider,
              type: 'first_party',
              installStatus: 'Not Installed',
              analyticsParams,
              suppressSuccessMessage: true,
              modalParams,
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
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} aria-label={t('More providers')}>
                {t('More')}
              </OverlayTrigger.Button>
            )}
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
                  analyticsParams,
                  suppressSuccessMessage: true,
                  modalParams,
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
