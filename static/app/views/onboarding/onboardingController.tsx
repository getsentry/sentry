import {ComponentPropsWithoutRef, useEffect} from 'react';

import {logExperiment} from 'sentry/utils/analytics';
import withExperiment from 'sentry/utils/withExperiment';
import withOrganization from 'sentry/utils/withOrganization';

import TargetedOnboarding from './targetedOnboarding/onboarding';
import Onboarding from './onboarding';

type Props = Omit<ComponentPropsWithoutRef<typeof Onboarding>, 'projects'> & {
  experimentAssignment: 0 | 1;
  logExperiment: () => void;
};

function OnboardingController({experimentAssignment, ...rest}: Props) {
  useEffect(() => {
    logExperiment({
      key: 'TargetedOnboardingWelcomePageExperimentV2',
      organization: rest.organization,
    });
  }, []);
  if (
    (rest.params.step === 'welcome' && experimentAssignment) ||
    rest.organization?.experiments.TargetedOnboardingMultiSelectExperiment
  ) {
    return <TargetedOnboarding {...rest} />;
  }
  return <Onboarding {...rest} />;
}

export default withOrganization(
  withExperiment(OnboardingController, {
    experiment: 'TargetedOnboardingWelcomePageExperimentV2',
    injectLogExperiment: true,
  })
);
