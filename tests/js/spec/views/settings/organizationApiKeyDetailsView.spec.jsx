import React from 'react';
import PropTypes from 'prop-types';

import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationApiKeyDetails from 'app/views/settings/organizationApiKeys/organizationApiKeyDetails';

const childContextTypes = {
  organization: PropTypes.object,
  router: PropTypes.object,
  location: PropTypes.object,
};

describe('OrganizationApiKeyDetails', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey(),
    });
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
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

    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(wrapper).toSnapshot();
  });
});
