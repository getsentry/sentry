import {ApiKey} from 'fixtures/js-stubs/apiKey';
import {Organization} from 'fixtures/js-stubs/organization';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeyDetails from 'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails';

describe('OrganizationApiKeyDetails', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: ApiKey(),
    });
  });

  it('renders', function () {
    const wrapper = render(
      <OrganizationApiKeyDetails params={{apiKey: 1, orgId: 'org-slug'}} />,
      {
        context: routerContext(),
        organization: Organization(),
      }
    );

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(wrapper.container).toSnapshot();
  });
});
