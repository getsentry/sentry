import {Component} from 'react';
import PropTypes from 'prop-types';

import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

import OrganizationRateLimits from './organizationRateLimits';

class OrganizationRateLimitsContainer extends Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    routes: PropTypes.array,
  };

  render() {
    if (!this.props.organization) {
      return null;
    }

    return <OrganizationRateLimits {...this.props} />;
  }
}

export default withOrganization(OrganizationRateLimitsContainer);
