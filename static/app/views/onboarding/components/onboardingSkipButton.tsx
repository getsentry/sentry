import {IconNext} from '@sentry/icons/next';

import {Button} from '@sentry/scraps/button';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useOnboardingSidebar} from 'sentry/components/onboarding/useOnboardingSidebar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OnboardingStepId} from 'sentry/views/onboarding/types';

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
  const navigate = useNavigate();
  const {discardOnboardingSession} = useOnboardingContext();
  const {activateSidebar} = useOnboardingSidebar();

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
      onSkip: () => {
        // Clear the staged session so the next onboarding visit starts fresh.
        discardOnboardingSession();
        activateSidebar({userClicked: false, source: config.sidebarSource});
        navigate(
          `/organizations/${organization.slug}/issues/?referrer=${config.referrer}`
        );
      },
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
