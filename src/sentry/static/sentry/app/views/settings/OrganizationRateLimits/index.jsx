import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

import OrganizationState from 'app/mixins/organizationState';

import OrganizationRateLimits from './organizationRateLimits';

const OrganizationRateLimitsContainer = createReactClass({
  displayName: 'OrganizationRateLimits',
  propTypes: {
    routes: PropTypes.array,
  },
  mixins: [OrganizationState],

  render() {
    if (!this.context.organization) return null;

    return (
      <OrganizationRateLimits {...this.props} organization={this.context.organization} />
    );
  },
});

export default OrganizationRateLimitsContainer;
