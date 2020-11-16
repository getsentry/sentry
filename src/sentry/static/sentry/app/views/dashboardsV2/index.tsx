import React from 'react';

import {Organization} from 'app/types';
import Feature from 'app/components/acl/feature';
import withOrganization from 'app/utils/withOrganization';
import DashboardsV1 from 'app/views/dashboards';

type Props = {
  organization: Organization;
  children: React.ReactNode;
};

class DashboardsV2Container extends React.Component<Props> {
  renderNoAccess() {
    const {children} = this.props;
    return <DashboardsV1>{children}</DashboardsV1>;
  }

  render() {
    const {organization, children} = this.props;

    return (
      <Feature
        features={['dashboards-v2']}
        requireAll={false}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        {children}
      </Feature>
    );
  }
}

export default withOrganization(DashboardsV2Container);
