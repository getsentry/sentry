import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import AuthLogout from './index';

function renderLogout(query = '') {
  return render(<AuthLogout />, {
    initialRouterConfig: {
      location: {pathname: '/auth/logout/', query: query ? {next: query} : {}},
      route: '/auth/logout/',
    },
  });
}

describe('AuthLogout', () => {
  beforeEach(() => {
    ConfigStore.set('isAuthenticated', true);
    ConfigStore.set('user', UserFixture({name: 'Jane Doe'}));
  });

  it('signs out and returns to sign in', async () => {
    const logout = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      statusCode: 204,
    });

    renderLogout();

    expect(screen.getByRole('heading', {name: 'Sign out'})).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith('/auth/login/')
    );
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('returns to a same-origin next url', async () => {
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', statusCode: 204});

    renderLogout('/welcome/?ref=logout');
    await userEvent.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        `${window.location.origin}/welcome/?ref=logout`
      )
    );
  });

  it('keeps a same-origin url with a protocol-relative path on this host', async () => {
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', statusCode: 204});

    renderLogout(`${window.location.origin}//example.com`);
    await userEvent.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        `${window.location.origin}//example.com`
      )
    );
  });

  it.each(['https://example.com', '//example.com', '///example.com', '/\\example.com'])(
    'ignores the external next url %s',
    async next => {
      MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', statusCode: 204});

      renderLogout(next);
      await userEvent.click(screen.getByRole('button', {name: 'Sign out'}));

      await waitFor(() =>
        expect(testableWindowLocation.assign).toHaveBeenCalledWith('/auth/login/')
      );
    }
  );

  it('follows the SAML single logout url', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      body: {sloUrl: 'https://idp.example.com/slo'},
    });

    renderLogout('/welcome/');
    await userEvent.click(screen.getByRole('button', {name: 'Sign out'}));

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://idp.example.com/slo'
      )
    );
  });

  it('shows an error when sign out fails', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      statusCode: 500,
      body: {detail: 'Sign out failed.'},
    });

    renderLogout();
    await userEvent.click(screen.getByRole('button', {name: 'Sign out'}));

    expect(await screen.findByText('Sign out failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Sign out'})).toBeEnabled();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('links to sign in when already signed out', () => {
    ConfigStore.set('isAuthenticated', false);

    renderLogout();

    expect(screen.getByText('You are signed out.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Sign in'})).toHaveAttribute(
      'href',
      '/auth/login/'
    );
    expect(screen.queryByRole('button', {name: 'Sign out'})).not.toBeInTheDocument();
  });
});
