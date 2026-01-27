import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex} from '@sentry/scraps/layout/flex';
import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavContext} from 'sentry/views/nav/context';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';
import {NavLayout} from 'sentry/views/nav/types';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import {useSeerOnboardingStep} from 'getsentry/views/seerAutomation/onboarding/hooks/useSeerOnboardingStep';
import {Steps} from 'getsentry/views/seerAutomation/onboarding/types';

export default function PrimaryNavSeerConfigReminder() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isPending, initialStep} = useSeerOnboardingStep();

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
    state,
  } = usePrimaryButtonOverlay();

  const {layout} = useNavContext();

  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');
  const hasSeer = hasSeatBasedSeer || hasLegacySeer || hasCodeReviewBeta;
  if (!hasSeer) {
    return false;
  }

  if (!canWrite && !isActiveSuperuser()) {
    return null;
  }

  if (isPending || initialStep === Steps.WRAP_UP) {
    return null;
  }

  return (
    <Fragment>
      <SeerButton
        analyticsKey="seer-config-reminder"
        label={t('Configure Seer')}
        buttonProps={overlayTriggerProps}
      >
        <IconSeer />
        <SidebarItemUnreadIndicator
          data-test-id="seer-config-reminder-indicator"
          isMobile={layout === NavLayout.MOBILE}
        />
      </SeerButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <Stack gap="md" padding="xl">
            <Heading as="h3">
              {hasSeatBasedSeer
                ? t('Finish configuring Seer')
                : hasLegacySeer
                  ? t('Start using Seer\u2019s AI Code Review')
                  : t('Start using Seer\u2019s Issue Autofix')}
            </Heading>
            <Text>
              {hasSeatBasedSeer
                ? t(
                    "Make sure you're getting the most out of Sentry. Finish setting up Seer to start using Root Cause Analysis and AI Code Review."
                  )
                : hasLegacySeer
                  ? t(
                      'Your current Seer plan also includes access to AI Code Review. Finish setting up to get the most out of Sentry.'
                    )
                  : t(
                      'Your current Seer plan also includes access to Issue Autofix. Finish setting up to get the most out of Sentry.'
                    )}
            </Text>
            <Flex>
              <LinkButton
                to={{
                  pathname: `/organizations/${organization.slug}/settings/seer/`,
                  query: {
                    tab: hasLegacySeer ? 'repos' : undefined,
                  },
                }}
                priority="primary"
                onClick={() => state.close()}
              >
                {t('Configure Now')}
              </LinkButton>
            </Flex>
          </Stack>
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

const SeerButton = styled(SidebarButton)`
  display: none;

  /* TODO(ryan953): Make this shorter once showPreventNav() is removed from PrimaryNavigationItems */
  @media (min-height: 724px) {
    display: flex;
  }
`;
