import {IconNext} from '@sentry/icons/next';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OnboardingStepId} from 'sentry/views/onboarding/types';
import {useLeaveOnboarding} from 'sentry/views/onboarding/useLeaveOnboarding';

import {openOnboardingSkipModal} from './onboardingSkipModal';

type SidebarSource = QuickStartEventParameters['quick_start.opened']['source'];

interface SkipAnalyticsConfig {
  referrer: string;
  sidebarSource: SidebarSource;
}

const SKIP_CONFIG_BY_STEP: Record<OnboardingStepId, SkipAnalyticsConfig> = {
  [OnboardingStepId.WELCOME]: {
    sidebarSource: 'targeted_onboarding_welcome_skip',
    referrer: 'onboarding-welcome-skip',
  },
  [OnboardingStepId.SCM_CONNECT]: {
    sidebarSource: 'targeted_onboarding_scm_connect_skip',
    referrer: 'onboarding-scm-connect-skip',
  },
  [OnboardingStepId.SCM_PLATFORM_FEATURES]: {
    sidebarSource: 'targeted_onboarding_scm_platform_features_skip',
    referrer: 'onboarding-scm-platform-features-skip',
  },
  [OnboardingStepId.SCM_MESSAGING]: {
    // VDY-146 will add treatment-specific interaction analytics.
    sidebarSource: 'onboarding_sidebar',
    referrer: 'onboarding-scm-messaging-skip',
  },
  [OnboardingStepId.SETUP_DOCS]: {
    sidebarSource: 'targeted_onboarding_first_event_footer_skip',
    referrer: 'onboarding-first-event-footer-skip',
  },
};

interface OnboardingSkipButtonProps {
  stepId: OnboardingStepId;
}

export function OnboardingSkipButton({stepId}: OnboardingSkipButtonProps) {
  const organization = useOrganization();
  const leaveOnboarding = useLeaveOnboarding();

  const config = SKIP_CONFIG_BY_STEP[stepId];

  const handleClick = () => {
    trackAnalytics('onboarding.scm_header_skip_clicked', {
      organization,
      opens_modal: true,
      step: stepId,
    });
    openOnboardingSkipModal({
      organization,
      step: stepId,
      onSkip: () =>
        leaveOnboarding({
          to: `/organizations/${organization.slug}/issues/?referrer=${config.referrer}`,
          sidebarSource: config.sidebarSource,
        }),
    });
  };

  return (
    <Button
      variant="transparent"
      size="xs"
      icon={<IconNext size="xs" />}
      onClick={handleClick}
    >
      {t('Skip setup')}
    </Button>
  );
}
