import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationRepositories from 'app/views/organizationRepositoriesView';

const childContextTypes = {
  organization: React.PropTypes.object,
  location: React.PropTypes.object,
};

describe('OrganizationRepositoriesView', function() {
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
        let wrapper = shallow(<OrganizationRepositories params={{orgId: 'org-slug'}} />, {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
            location: TestStubs.location(),
          },
          childContextTypes,
        });
        expect(wrapper).toMatchSnapshot();
      });
    });
  });
});
