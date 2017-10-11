import React from 'react';

import OrganizationState from '../../mixins/organizationState';
import LazyLoad from '../../components/lazyLoad';
import getSettingsComponent from '../../utils/getSettingsComponent';

const OrganizationRateLimits = React.createClass({
  mixins: [OrganizationState],

  render() {
    if (!this.context.organization) return null;

    return (
      <LazyLoad
        component={() =>
          getSettingsComponent(
            () =>
              import(/*webpackChunkName: "rateLimitView"*/ '../settings/organization/rateLimit/rateLimitView'),
            () => import(/*webpackChunkName: "rateLimitView.old"*/ './rateLimitView.old'),
            this.props.routes
          )}
        {...this.props}
        organization={this.context.organization}
      />
    );
  },
});

export default OrganizationRateLimits;
