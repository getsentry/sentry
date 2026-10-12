import {waitFor} from 'sentry-test/reactTestingLibrary';

import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {logout} from './account';

describe('logout', () => {
  it('logs out and redirects to the login page', async () => {
    const mockApi = new MockApiClient();
    const mockApiDelete = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    logout(mockApi);

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled());
    expect(testableWindowLocation.assign).toHaveBeenCalledWith('/auth/login/');
  });

  it('can log out without redirecting', async () => {
    const mockApi = new MockApiClient();
    const mockApiDelete = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });
    const csrfRequest = MockApiClient.addMockResponse({
      url: '/auth-v2/csrf/',
      method: 'GET',
    });

    await logout(mockApi, {redirect: false});

    expect(mockApiDelete).toHaveBeenCalled();
    expect(csrfRequest).toHaveBeenCalled();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('follows a SAML single logout URL when redirects are disabled', async () => {
    const mockApi = new MockApiClient();
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      body: {sloUrl: 'https://idp.example.com/logout'},
    });

    await logout(mockApi, {redirect: false});

    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://idp.example.com/logout'
    );
  });
});
