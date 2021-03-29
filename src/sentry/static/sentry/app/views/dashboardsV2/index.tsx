import React from 'react';

import Feature from 'app/components/acl/feature';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  children: React.ReactNode;
};

class DashboardsV2Container extends React.Component<Props> {
  render() {
    const {organization, children} = this.props;

    return (
      <Feature features={['dashboards-basic']} organization={organization}>
        {children}
      </Feature>
    );
  }
}

export default withOrganization(DashboardsV2Container);
