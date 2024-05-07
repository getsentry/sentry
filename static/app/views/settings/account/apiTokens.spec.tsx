import {ApiTokenFixture} from 'sentry-fixture/apiToken';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {ApiTokens} from 'sentry/views/settings/account/apiTokens';

const organization = OrganizationFixture();

describe('ApiTokens', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty result', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: null,
    });

    render(<ApiTokens organization={organization} />);
  });

  it('renders with result', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [ApiTokenFixture()],
    });

    render(<ApiTokens organization={organization} />);
  });

  it('can delete token', async function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [ApiTokenFixture()],
    });

    const mock = MockApiClient.addMockResponse({
      url: '/api-tokens/',
      method: 'DELETE',
    });
    expect(mock).not.toHaveBeenCalled();

    render(<ApiTokens organization={organization} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Remove'}));
    // Confirm modal
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // Should be loading
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/api-tokens/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
