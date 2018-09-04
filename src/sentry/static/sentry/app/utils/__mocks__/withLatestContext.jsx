import React from 'react';

const MOCK_ORG = TestStubs.Organization();
const DEFAULTS = {
  organization: MOCK_ORG,
  organizations: [MOCK_ORG],
  project: TestStubs.Project(),
  lastRoute: {},
};

const withLatestContextMock = WrappedComponent =>
  class WithLatestContextMockWrappeer extends React.Component {
    render() {
      return <WrappedComponent {...DEFAULTS} {...this.props} />;
    }
  };

export default withLatestContextMock;
