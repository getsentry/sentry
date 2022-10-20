import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeys from 'sentry/views/settings/organizationApiKeys';

const routes = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeys', function () {
  let getMock, deleteMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [TestStubs.ApiKey()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey(),
    });
    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'DELETE',
    });
  });

  it('fetches api keys', function () {
    render(
      <OrganizationApiKeys
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('can delete a key', function () {
    render(
      <OrganizationApiKeys
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />
    );

    expect(deleteMock).toHaveBeenCalledTimes(0);
    userEvent.click(screen.getByRole('link', {name: 'Remove API Key?'}));

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
