import {RouteComponentProps} from 'react-router';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import Container from './container';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

const OrganizationStats = (props: Props) => <Container {...props} />;
export default withOrganization(OrganizationStats);
