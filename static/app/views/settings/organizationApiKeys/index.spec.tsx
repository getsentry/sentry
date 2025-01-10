import {DeprecatedApiKeyFixture} from 'sentry-fixture/deprecatedApiKey';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeys from 'sentry/views/settings/organizationApiKeys';

describe('OrganizationApiKeys', function () {
  let getMock: jest.Mock;
  let deleteMock: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [DeprecatedApiKeyFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: DeprecatedApiKeyFixture(),
    });
    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'DELETE',
    });
  });

  it('fetches api keys', async function () {
    render(<OrganizationApiKeys />);

    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('can delete a key', async function () {
    render(<OrganizationApiKeys />);
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('link', {name: 'Remove API Key?'}));
    expect(deleteMock).toHaveBeenCalledTimes(0);

    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
