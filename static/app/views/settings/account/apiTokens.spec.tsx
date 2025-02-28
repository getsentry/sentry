import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {ApiTokens} from 'sentry/views/settings/account/apiTokens';

jest.mock('sentry/utils/demoMode');

describe('ApiTokens', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty result', async function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: null,
    });

    render(<ApiTokens />);

    expect(
      await screen.findByText("You haven't created any authentication tokens yet.")
    ).toBeInTheDocument();
  });

  it('renders with result', async function () {
    const token1 = ApiTokenFixture({id: '1', name: 'token1'});
    const token2 = ApiTokenFixture({id: '2', name: 'token2'});

    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [token1, token2],
    });

    render(<ApiTokens />);

    expect(await screen.findByText('token1')).toBeInTheDocument();
    expect(screen.getByText('token2')).toBeInTheDocument();
  });

  it('renders empty in demo mode even if there are tokens', async function () {
    (isDemoModeEnabled as jest.Mock).mockReturnValue(true);

    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [ApiTokenFixture()],
    });

    render(<ApiTokens />);

    expect(
      await screen.findByText("You haven't created any authentication tokens yet.")
    ).toBeInTheDocument();

    (isDemoModeEnabled as jest.Mock).mockReset();
  });

  it('can delete token', async function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [ApiTokenFixture()],
    });

    const deleteTokenMock = MockApiClient.addMockResponse({
      url: '/api-tokens/',
      method: 'DELETE',
    });

    render(<ApiTokens />);
    renderGlobalModal();
    const removeButton = await screen.findByRole('button', {name: 'Remove'});
    expect(removeButton).toBeInTheDocument();
    expect(deleteTokenMock).not.toHaveBeenCalled();

    // mock response for refetch after delete
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [],
    });

    await userEvent.click(removeButton);
    // Confirm modal
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // Wait for list to update
    expect(
      await screen.findByText("You haven't created any authentication tokens yet.")
    ).toBeInTheDocument();

    // Should have called delete
    expect(deleteTokenMock).toHaveBeenCalledTimes(1);
    expect(deleteTokenMock).toHaveBeenCalledWith(
      '/api-tokens/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
