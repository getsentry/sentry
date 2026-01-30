import {useCallback, type PropsWithChildren} from 'react';

import {Link} from 'sentry/components/core/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

export function WelcomeSkipButton({children}: PropsWithChildren) {
  const organization = useOrganization();
  const {activateSidebar} = useOnboardingSidebar();
  const source = 'targeted_onboarding';

  const handleSkipOnboarding = useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_skip', {
      organization,
      source,
    });

    activateSidebar({userClicked: false, source: 'targeted_onboarding_welcome_skip'});
  }, [organization, source, activateSidebar]);

  return (
    <Link
      onClick={handleSkipOnboarding}
      to={`/organizations/${organization.slug}/issues/?referrer=onboarding-welcome-skip`}
    >
      {children}
    </Link>
  );
}
