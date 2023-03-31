import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import HookOrDefault from 'sentry/components/hookOrDefault';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactChildren;
  organization: Organization;
};

const BetaGracePeriodAlertHook = HookOrDefault({
  hookName: 'component:replay-beta-grace-period-alert',
});

function ReplaysContainer({organization, children}: Props) {
  return (
    <NoProjectMessage organization={organization}>
      <Feature
        features={['session-replay-beta-grace']}
        organization={organization}
        renderDisabled={false}
      >
        <BetaGracePeriodAlertHook organization={organization} />
      </Feature>

      {children}
    </NoProjectMessage>
  );
}

export default withOrganization(ReplaysContainer);
