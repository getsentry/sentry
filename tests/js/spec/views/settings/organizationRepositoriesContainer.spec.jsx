import * as PropTypes from 'prop-types';

import {render} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import OrganizationRepositoriesContainer from 'sentry/views/settings/organizationRepositories';

const childContextTypes = {
  organization: PropTypes.object,
  location: PropTypes.object,
};

describe('OrganizationRepositoriesContainer', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  describe('without any providers', function () {
    beforeEach(function () {
      Client.addMockResponse({
        url: '/organizations/org-slug/repos/',
        body: [],
      });
      Client.addMockResponse({
        url: '/organizations/org-slug/config/repos/',
        body: {providers: []},
      });
    });

    it('is loading when initially rendering', function () {
      const wrapper = render(
        <OrganizationRepositoriesContainer params={{orgId: 'org-slug'}} />,
        {
          context: {
            context: {
              router: TestStubs.router(),
              organization: TestStubs.Organization(),
              location: TestStubs.location(),
            },
            childContextTypes,
          },
        }
      );
      expect(wrapper.container).toSnapshot();
    });
  });
});
