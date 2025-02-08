import {Component} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

const MOCK_ORG = OrganizationFixture();
const DEFAULTS = {
  organization: MOCK_ORG,
  organizations: [MOCK_ORG],
  project: ProjectFixture(),
};

const withLatestContextMock = (WrappedComponent: any) =>
  class WithLatestContextMockWrapper extends Component {
    render() {
      return <WrappedComponent {...DEFAULTS} {...this.props} />;
    }
  };

export default withLatestContextMock;
