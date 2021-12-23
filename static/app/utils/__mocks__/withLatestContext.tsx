import {Component} from 'react';

declare const TestStubs;

const MOCK_ORG = TestStubs.Organization();
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
