import {Component} from 'react';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

const MOCK_ORG = Organization();
const DEFAULTS = {
  organization: MOCK_ORG,
  organizations: [MOCK_ORG],
  project: ProjectFixture(),
};

const withLatestContextMock = WrappedComponent =>
  class WithLatestContextMockWrapper extends Component {
    render() {
      return <WrappedComponent {...DEFAULTS} {...this.props} />;
    }
  };

export default withLatestContextMock;
