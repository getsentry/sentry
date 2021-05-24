import {RouteComponentProps} from 'react-router';

import NotFound from 'app/components/errors/notFound';
import HookOrDefault from 'app/components/hookOrDefault';
import {OrganizationSummary} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';

type Props = {
  organizations: OrganizationSummary[];
} & RouteComponentProps<{orgId: string}, {}>;

//getsentry will add the view
const DisabledMemberComponent = HookOrDefault({
  hookName: 'component:disabled-member',
  defaultComponent: () => <NotFound />,
});

function DisabledMember(props: Props) {
  const {
    organizations,
    params: {orgId},
  } = props;
  const org = organizations.find(o => o.slug === orgId);
  if (!org) {
    return null;
  }
  return <DisabledMemberComponent organization={org} />;
}

export default withOrganizations(DisabledMember);
