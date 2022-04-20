import {ComponentPropsWithoutRef} from 'react';

import {logExperiment} from 'sentry/utils/analytics';
import withOrganization from 'sentry/utils/withOrganization';

import TargetedOnboarding from './targetedOnboarding/onboarding';
import Onboarding from './onboarding';

type Props = Omit<ComponentPropsWithoutRef<typeof Onboarding>, 'projects'>;

function OnboardingController({...rest}: Props) {
  logExperiment({
    key: 'TargetedOnboardingMultiSelectExperiment',
    organization: rest.organization,
  });
  if (rest.organization?.experiments.TargetedOnboardingMultiSelectExperiment) {
    return <TargetedOnboarding {...rest} />;
  }
  return <Onboarding {...rest} />;
}

export default withOrganization(OnboardingController);
