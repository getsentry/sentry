import {RouteComponentProps} from 'react-router';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';

import Onboarding from './onboarding';

type Props = RouteComponentProps<
  {
    step: string;
  },
  {}
>;

export default function OnboardingContainer(props: Props) {
  return (
    <OnboardingContextProvider>
      <Onboarding {...props} />
    </OnboardingContextProvider>
  );
}
