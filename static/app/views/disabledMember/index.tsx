import {RouteComponentProps} from 'react-router';

import {OrganizationSummary} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';

type Props = {
  organizations: OrganizationSummary[];
} & RouteComponentProps<{orgId: string}, {}>;

//TODO: finish view
function DisabledMember(props: Props) {
  const {
    organizations,
    params: {orgId},
  } = props;
  const org = organizations.find(o => o.slug === orgId);
  return <div>Disabled user for org {org?.slug}</div>;
}

export default withOrganizations(DisabledMember);
