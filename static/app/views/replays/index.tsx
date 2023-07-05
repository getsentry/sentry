import {RouteComponentProps} from 'react-router';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactNode;
  organization: Organization;
};

function ReplaysContainer({organization, children}: Props) {
  return <NoProjectMessage organization={organization}>{children}</NoProjectMessage>;
}

export default withOrganization(ReplaysContainer);
