import React from 'react';
import PropTypes from 'prop-types';

import createReactClass from 'create-react-class';

import OrganizationState from 'app/mixins/organizationState';
import LazyLoad from 'app/components/lazyLoad';

const OrganizationRateLimits = createReactClass({
  displayName: 'OrganizationRateLimits',
  propTypes: {
    routes: PropTypes.array,
  },
  mixins: [OrganizationState],

  render() {
    if (!this.context.organization) return null;

    return (
      // TODO(billy): Move to routes
      <LazyLoad
        component={() =>
          import(/*webpackChunkName: "rateLimitView"*/ '../settings/organization/rateLimit/rateLimitView').then(
            mod => mod.default
          )}
        {...this.props}
        organization={this.context.organization}
      />
    );
  },
});

export default OrganizationRateLimits;
