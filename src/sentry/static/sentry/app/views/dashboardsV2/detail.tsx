import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  location: Location;
  organization: Organization;
};
class DashboardDetail extends React.Component<Props> {
  render() {
    const {organization, location} = this.props;

    if (!organization.features.includes('dashboards-v2')) {
      // Redirect to Dashboards v1
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }

    return <div>dashboard detail</div>;
  }
}

export default withOrganization(DashboardDetail);
