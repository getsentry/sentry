import {Component} from 'react';
import {Organization} from 'sentry-fixture/organization';

declare const TestStubs;

const MOCK_ORG = Organization();
const DEFAULTS = {
  organization: MOCK_ORG,
  organizations: [MOCK_ORG],
  project: TestStubs.Project(),
};

const withLatestContextMock = WrappedComponent =>
  class WithLatestContextMockWrapper extends Component {
    render() {
      return <WrappedComponent {...DEFAULTS} {...this.props} />;
    }
  };

export default withLatestContextMock;
