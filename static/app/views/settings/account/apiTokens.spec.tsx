import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {ApiTokens} from 'sentry/views/settings/account/apiTokens';

describe('ApiTokens', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty result', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: null,
    });

    render(<ApiTokens />);
  });

  it('renders with result', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [ApiTokenFixture()],
    });

    render(<ApiTokens />);
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

    render(<ApiTokens />);
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
