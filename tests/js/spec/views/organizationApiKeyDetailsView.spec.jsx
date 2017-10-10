import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationApiKeyDetailsView
  from 'app/views/settings/organization/apiKeys/organizationApiKeyDetailsView';

const childContextTypes = {
  organization: React.PropTypes.object,
  router: React.PropTypes.object,
  location: React.PropTypes.object
};

describe('OrganizationApiKeyDetailsView', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [TestStubs.ApiKey()]
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey()
    });
  });

  it('renders', function() {
    let wrapper = mount(
      <OrganizationApiKeyDetailsView params={{apiKey: 1, orgId: 'org-slug'}} />,
      {
        context: {
          router: TestStubs.router(),
          organization: TestStubs.Organization(),
          location: TestStubs.location()
        },
        childContextTypes
      }
    );
    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper).toMatchSnapshot();
  });
});
