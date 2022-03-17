import {ComponentPropsWithoutRef} from 'react';

import withExperiment from 'sentry/utils/withExperiment';
import withOrganization from 'sentry/utils/withOrganization';

import TargetedOnboarding from './targetedOnboarding/onboarding';
import Onboarding from './onboarding';

type Props = Omit<ComponentPropsWithoutRef<typeof Onboarding>, 'projects'> & {
  experimentAssignment: 0 | 1;
  logExperiment: () => void;
};

function OnboardingController({experimentAssignment, ...rest}: Props) {
  /*
  TODO: enable logExperiment after testing & launch
  useEffect(() => {
    logExperiment({
      key: 'TargetedOnboardingWelcomePageExperiment',
      organization: rest.organization,
    });
  }, []);
  */
  if (rest.params.step === 'welcome' && experimentAssignment) {
    return <TargetedOnboarding />;
  }
  return <Onboarding {...rest} />;
}

export default withOrganization(
  withExperiment(OnboardingController, {
    experiment: 'TargetedOnboardingWelcomePageExperiment',
    injectLogExperiment: true,
  })
);
