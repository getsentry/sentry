import {useEffect} from 'react';

import {logExperiment} from 'sentry/utils/analytics';
import isMobile from 'sentry/utils/isMobile';
import withOrganization from 'sentry/utils/withOrganization';

import TargetedOnboarding from './targetedOnboarding/onboarding';

type Props = Omit<React.ComponentPropsWithoutRef<typeof TargetedOnboarding>, 'projects'>;

function OnboardingController({...rest}: Props) {
  useEffect(() => {
    if (isMobile()) {
      logExperiment({
        key: 'TargetedOnboardingMobileRedirectExperiment',
        organization: rest.organization,
      });
    }
    logExperiment({
      key: 'TargetedOnboardingIntegrationSelectExperiment',
      organization: rest.organization,
    });
  }, [rest.organization]);
  return <TargetedOnboarding {...rest} />;
}

export default withOrganization(OnboardingController);
