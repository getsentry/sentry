import PropTypes from 'prop-types';
import React from 'react';

import {mount} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationApiKeyDetails from 'app/views/settings/organizationApiKeys/organizationApiKeyDetails';

jest.mock('jquery');

const childContextTypes = {
  organization: PropTypes.object,
  router: PropTypes.object,
  location: PropTypes.object,
};

describe('OrganizationApiKeyDetails', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [TestStubs.ApiKey()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey(),
    });
  });

  it('renders', function() {
    const wrapper = mount(
      <OrganizationApiKeyDetails params={{apiKey: 1, orgId: 'org-slug'}} />,
      {
        context: {
          router: TestStubs.router(),
          organization: TestStubs.Organization(),
          location: TestStubs.location(),
        },
        childContextTypes,
      }
    );
    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper).toSnapshot();
  });
});
