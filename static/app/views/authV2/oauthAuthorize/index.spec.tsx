import {focusManager} from '@tanstack/react-query';
import {OAuthConsentFixture, OAuthContextFixture} from 'sentry-fixture/oauth';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {mockElementFromPoint} from 'sentry/views/authV2/authLogin/components/testUtils';

import OAuthAuthorize from '.';

const location = {
  pathname: '/oauth/authorize/',
  search:
    '?client_id=example-client&response_type=code&state=original&code_challenge=challenge&code_challenge_method=S256',
};

describe('OAuthAuthorize', () => {
  mockElementFromPoint();
  const originalConfig = ConfigStore.getState();
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/context/',
      body: OAuthContextFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture(),
    });
  });
  afterEach(() => {
    ConfigStore.loadInitialData(originalConfig);
    focusManager.setFocused(undefined);
  });

  it('shows the request and account, then posts explicit approval', async () => {
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {stage: 'redirect', redirectUrl: 'https://example.com/callback?code=issued'},
    });
    render(<OAuthAuthorize />, {
      initialRouterConfig: {
        location: {
          pathname: location.pathname,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
      },
    });
    expect(await screen.findByRole('button', {name: 'Authorize'})).toBeEnabled();
    await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    expect(screen.getByRole('row', {name: /Projects/})).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Authorize'}));
    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {op: 'approve', transactionId: 'prepared-transaction'},
        })
      )
    );
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://example.com/callback?code=issued'
    );
  });

  it('auto-approves existing consent exactly once', async () => {
    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture({hasExistingConsent: true}),
    });
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {stage: 'redirect', redirectUrl: 'https://example.com/callback'},
    });
    render(<OAuthAuthorize />, {
      initialRouterConfig: {
        location: {
          pathname: location.pathname,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
      },
    });
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it.each(['1', 'false'])(
    'requires confirmation for force_prompt=%s',
    async forcePrompt => {
      MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/',
        body: OAuthConsentFixture({hasExistingConsent: true}),
      });
      const approve = MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/',
        method: 'POST',
        body: {stage: 'redirect', redirectUrl: 'https://example.com/callback'},
      });
      render(<OAuthAuthorize />, {
        initialRouterConfig: {
          location: {
            ...location,
            query: {
              ...Object.fromEntries(new URLSearchParams(location.search)),
              force_prompt: forcePrompt,
            },
          },
        },
      });
      expect(await screen.findByRole('button', {name: 'Authorize'})).toBeEnabled();
      expect(approve).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', {name: 'Authorize'}));
      await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    }
  );

  it('posts denial and follows the server callback', async () => {
    const deny = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {
        stage: 'redirect',
        redirectUrl: 'https://example.com/callback?error=access_denied',
      },
    });
    render(<OAuthAuthorize />, {
      initialRouterConfig: {
        location: {
          pathname: location.pathname,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Deny'}));
    await waitFor(() =>
      expect(deny).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {op: 'deny', transactionId: 'prepared-transaction'},
        })
      )
    );
  });
});
