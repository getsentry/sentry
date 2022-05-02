import withOrganization from 'sentry/utils/withOrganization';

import TargetedOnboarding from './targetedOnboarding/onboarding';

type Props = Omit<React.ComponentPropsWithoutRef<typeof TargetedOnboarding>, 'projects'>;

function OnboardingController({...rest}: Props) {
  // TODO: uncomment
  // useEffect(() => {
  //   logExperiment({
  //     key: 'TargetedOnboardingMobileRedirectExperiment',
  //     organization: rest.organization,
  //   });
  // }, [rest.organization]);
  return <TargetedOnboarding {...rest} />;
}

export default withOrganization(OnboardingController);
