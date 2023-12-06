import {RouteComponentProps} from 'react-router';

import RelocationOnboarding from './relocation';

type Props = RouteComponentProps<{step: string}, {}>;

export default function RelocationOnboardingContainer(props: Props) {
  return <RelocationOnboarding {...props} />;
}
