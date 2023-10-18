import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import AccountIdentities from 'sentry/views/settings/account/accountIdentities';

const ENDPOINT = '/users/me/user-identities/';

describe('AccountIdentities', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [],
    });

    render(<AccountIdentities />);
  });

  it('renders list', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [
        {
          category: 'social-identity',
          id: '1',
          provider: {
            key: 'github',
            name: 'GitHub',
          },
          status: 'can_disconnect',
          organization: null,
        },
        {
          category: 'org-identity',
          id: '2',
          provider: {
            key: 'google',
            name: 'Google',
          },
          status: 'needed_for_global_auth',
          organization: null,
        },
      ],
    });

    render(<AccountIdentities />);

    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();

    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    expect(await screen.findByText('Google')).toBeInTheDocument();
  });

  it('renders loading error', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      statusCode: 400,
      body: {},
    });
    render(<AccountIdentities />);

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('disconnects identity', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [
        {
          category: 'social-identity',
          id: '1',
          provider: {
            key: 'github',
            name: 'GitHub',
          },
          status: 'can_disconnect',
          organization: null,
        },
      ],
    });

    render(<AccountIdentities />);

    const disconnectRequest = {
      url: `${ENDPOINT}social-identity/1/`,
      method: 'DELETE',
    };

    const mock = MockApiClient.addMockResponse(disconnectRequest);

    expect(mock).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', {name: 'Disconnect'}));

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(
      await screen.findByText(
        'There are no organization identities associated with your Sentry account'
      )
    ).toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      `${ENDPOINT}social-identity/1/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
