import {useCallback, type PropsWithChildren} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {ONBOARDING_WELCOME_SCREEN_SOURCE} from 'sentry/views/onboarding/consts';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

interface WelcomeSkipButtonProps {
  asButton?: boolean;
}

export function WelcomeSkipButton({
  children,
  asButton,
}: PropsWithChildren<WelcomeSkipButtonProps>) {
  const organization = useOrganization();
  const {activateSidebar} = useOnboardingSidebar();

  const handleSkipOnboarding = useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_skip', {
      organization,
      source: ONBOARDING_WELCOME_SCREEN_SOURCE,
    });

    activateSidebar({userClicked: false, source: 'targeted_onboarding_welcome_skip'});
  }, [organization, activateSidebar]);

  const to = `/organizations/${organization.slug}/issues/?referrer=onboarding-welcome-skip`;

  if (asButton) {
    return (
      <LinkButton priority="transparent" onClick={handleSkipOnboarding} to={to}>
        {children}
      </LinkButton>
    );
  }

  return (
    <Link onClick={handleSkipOnboarding} to={to}>
      {children}
    </Link>
  );
}
