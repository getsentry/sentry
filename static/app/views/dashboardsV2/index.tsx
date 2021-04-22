import React from 'react';
import {RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import Detail from './detail';

type Props = RouteComponentProps<{orgId: string; dashboardId: string}, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

class DashboardsV2Container extends React.Component<Props> {
  render() {
    const {organization, ...props} = this.props;

    return (
      <Feature features={['dashboards-basic']} organization={organization}>
        <Detail {...props} organization={organization} />
      </Feature>
    );
  }
}

export default withOrganization(DashboardsV2Container);
