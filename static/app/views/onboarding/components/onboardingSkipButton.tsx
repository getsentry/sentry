import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ONBOARDING_WELCOME_SCREEN_SOURCE} from 'sentry/views/onboarding/consts';
import {OnboardingStepId} from 'sentry/views/onboarding/types';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

type SidebarSource = QuickStartEventParameters['quick_start.opened']['source'];

interface SkipConfig {
  analyticsSource: string;
  referrer: string;
  sidebarSource: SidebarSource;
}

const SKIP_CONFIG_BY_STEP: Partial<Record<OnboardingStepId, SkipConfig>> = {
  [OnboardingStepId.WELCOME]: {
    analyticsSource: ONBOARDING_WELCOME_SCREEN_SOURCE,
    sidebarSource: 'targeted_onboarding_welcome_skip',
    referrer: 'onboarding-welcome-skip',
  },
  [OnboardingStepId.SCM_CONNECT]: {
    analyticsSource: 'targeted_onboarding_scm_connect',
    sidebarSource: 'targeted_onboarding_scm_connect_skip',
    referrer: 'onboarding-scm-connect-skip',
  },
  [OnboardingStepId.SCM_PLATFORM_FEATURES]: {
    analyticsSource: 'targeted_onboarding_scm_platform_features',
    sidebarSource: 'targeted_onboarding_scm_platform_features_skip',
    referrer: 'onboarding-scm-platform-features-skip',
  },
  [OnboardingStepId.SCM_PROJECT_DETAILS]: {
    analyticsSource: 'targeted_onboarding_scm_project_details',
    sidebarSource: 'targeted_onboarding_scm_project_details_skip',
    referrer: 'onboarding-scm-project-details-skip',
  },
  [OnboardingStepId.SETUP_DOCS]: {
    analyticsSource: 'targeted_onboarding_first_event_footer',
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
    trackAnalytics('growth.onboarding_clicked_skip', {
      organization,
      source: config.analyticsSource,
    });
    activateSidebar({userClicked: false, source: config.sidebarSource});
  };

  return (
    <LinkButton
      priority="transparent"
      onClick={handleClick}
      to={`/organizations/${organization.slug}/issues/?referrer=${config.referrer}`}
    >
      {t('Skip onboarding')}
    </LinkButton>
  );
}
