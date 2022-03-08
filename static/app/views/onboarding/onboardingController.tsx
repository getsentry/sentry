import * as React from 'react';

import {logExperiment} from 'sentry/utils/analytics';
import withExperiment from 'sentry/utils/withExperiment';
import withOrganization from 'sentry/utils/withOrganization';

import TargetedOnboarding from './targetedOnboarding/onboarding';
import Onboarding from './onboarding';

type Props = Omit<React.ComponentPropsWithoutRef<typeof Onboarding>, 'projects'> & {
  experimentAssignment: 0 | 1;
  logExperiment: () => void;
};

function OnboardingController({experimentAssignment, ...rest}: Props) {
  React.useEffect(() => {
    logExperiment({
      key: 'TargetedOnboardingWelcomePageExperiment',
      organization: rest.organization,
    });
  }, []);
  const {
    params: {step},
  } = rest;
  if (step === 'welcome' && experimentAssignment) {
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
