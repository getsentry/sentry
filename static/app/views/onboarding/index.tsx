import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import Onboarding from './onboarding';

type Props = RouteComponentProps<{step: string}>;

export default function OnboardingContainer(props: Props) {
  return <Onboarding {...props} />;
}
