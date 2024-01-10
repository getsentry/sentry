import {Component} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import * as SentryPropTypes from 'sentry/sentryPropTypeValidators';

const withOrganizationMock = WrappedComponent =>
  class WithOrganizationMockWrapper extends Component {
    static contextTypes = {
      organization: SentryPropTypes.isOrganization,
    };

    render() {
      return (
        <WrappedComponent
          organization={this.context.organization || OrganizationFixture()}
          {...this.props}
        />
      );
    }
  };

export default withOrganizationMock;
