import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OnboardingStepId} from 'sentry/views/onboarding/types';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

type SidebarSource = QuickStartEventParameters['quick_start.opened']['source'];

interface SkipAnalyticsConfig {
  referrer: string;
  sidebarSource: SidebarSource;
}

const SKIP_CONFIG_BY_STEP: Partial<Record<OnboardingStepId, SkipAnalyticsConfig>> = {
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
  [OnboardingStepId.SCM_PROJECT_DETAILS]: {
    sidebarSource: 'targeted_onboarding_scm_project_details_skip',
    referrer: 'onboarding-scm-project-details-skip',
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
  const {activateSidebar} = useOnboardingSidebar();

  const config = SKIP_CONFIG_BY_STEP[stepId];
  if (!config) {
    return null;
  }

  const handleClick = () => {
    trackAnalytics('onboarding.scm_header_skip_clicked', {
      organization,
      step: stepId,
    });
    activateSidebar({userClicked: false, source: config.sidebarSource});
  };

  return (
    <LinkButton
      priority="transparent"
      onClick={handleClick}
      to={`/organizations/${organization.slug}/issues/?referrer=${config.referrer}`}
    >
      {t('Skip setup')}
    </LinkButton>
  );
}
