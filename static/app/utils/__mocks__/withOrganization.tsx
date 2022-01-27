import {Component} from 'react';

import SentryTypes from 'sentry/sentryTypes';

declare const TestStubs;

const withOrganizationMock = WrappedComponent =>
  class WithOrganizationMockWrapper extends Component {
    static contextTypes = {
      organization: SentryTypes.Organization,
    };
    render() {
      return (
        <WrappedComponent
          organization={this.context.organization || TestStubs.Organization()}
          {...this.props}
        />
      );
    }
  };

export default withOrganizationMock;
