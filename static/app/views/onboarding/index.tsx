import {RouteComponentProps} from 'react-router';

import Onboarding from './onboarding';

type Props = RouteComponentProps<{step: string}, {}>;

export default function OnboardingContainer(props: Props) {
  return <Onboarding {...props} />;
}
