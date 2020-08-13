import PropTypes from 'prop-types';
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationRepositoriesContainer from 'app/views/settings/organizationRepositories';

const childContextTypes = {
  organization: PropTypes.object,
  location: PropTypes.object,
};

describe('OrganizationRepositoriesContainer', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    describe('without any providers', function() {
      beforeEach(function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/repos/',
          body: [],
        });
        Client.addMockResponse({
          url: '/organizations/org-slug/config/repos/',
          body: {providers: []},
        });
      });

      it('is loading when initially rendering', function() {
        const wrapper = mountWithTheme(
          <OrganizationRepositoriesContainer params={{orgId: 'org-slug'}} />,
          {
            context: {
              router: TestStubs.router(),
              organization: TestStubs.Organization(),
              location: TestStubs.location(),
            },
            childContextTypes,
          }
        );
        expect(wrapper).toSnapshot();
      });
    });
  });
});
