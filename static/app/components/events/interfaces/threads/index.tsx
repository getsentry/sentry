import {Organization} from 'app/types';

import CurrentVersion from './currentVersion';
import NewVersion from './newVersion';

type Props = React.ComponentProps<typeof NewVersion> & {
  organization: Organization;
};

function ThreadsContainer({organization, ...props}: Props) {
  const hasNativeStackTraceV2 = !!organization.features?.includes(
    'native-stack-trace-v2'
  );

  if (hasNativeStackTraceV2) {
    return <NewVersion {...props} />;
  }

  return <CurrentVersion {...props} />;
}

export default ThreadsContainer;
