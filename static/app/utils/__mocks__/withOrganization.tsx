import {Component} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import SentryTypes from 'sentry/sentryTypes';

const withOrganizationMock = WrappedComponent =>
  class WithOrganizationMockWrapper extends Component {
    static contextTypes = {
      organization: SentryTypes.Organization,
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
