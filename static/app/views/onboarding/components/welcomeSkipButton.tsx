import {useCallback, type PropsWithChildren} from 'react';

import {Link} from 'sentry/components/core/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {ONBOARDING_WELCOME_SCREEN_SOURCE} from 'sentry/views/onboarding/consts';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

export function WelcomeSkipButton({children}: PropsWithChildren) {
  const organization = useOrganization();
  const {activateSidebar} = useOnboardingSidebar();

  const handleSkipOnboarding = useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_skip', {
      organization,
      source: ONBOARDING_WELCOME_SCREEN_SOURCE,
    });

    activateSidebar({userClicked: false, source: 'targeted_onboarding_welcome_skip'});
  }, [organization, activateSidebar]);

  return (
    <Link
      onClick={handleSkipOnboarding}
      to={`/organizations/${organization.slug}/issues/?referrer=onboarding-welcome-skip`}
    >
      {children}
    </Link>
  );
}
