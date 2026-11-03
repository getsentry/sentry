import {focusManager} from '@tanstack/react-query';
import {OAuthConsentFixture, OAuthContextFixture} from 'sentry-fixture/oauth';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {mockElementFromPoint} from 'sentry/views/authV2/authLogin/components/testUtils';
import {waitForAuthorization} from 'sentry/views/authV2/oauth/testUtils';

import OAuthAuthorize from '.';

jest.setTimeout(15000);

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
    await waitForAuthorization();
    await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    expect(screen.getByRole('row', {name: /Projects/})).toBeVisible();
    await userEvent.click(await waitForAuthorization());
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
      await waitForAuthorization();
      expect(approve).not.toHaveBeenCalled();
      await userEvent.click(await waitForAuthorization());
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

  it.each([
    {lastOrganization: null, selectedName: 'First Org', selectedId: '1'},
    {lastOrganization: 'second-org', selectedName: 'Second Org', selectedId: '2'},
    {lastOrganization: 'unavailable-org', selectedName: 'First Org', selectedId: '1'},
  ])(
    'defaults to $selectedName with last organization $lastOrganization',
    async ({lastOrganization, selectedName, selectedId}) => {
      ConfigStore.set('lastOrganization', lastOrganization);
      const context = OAuthContextFixture();
      MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/context/',
        body: {
          ...context,
          application: {...context.application, requiresOrgLevelAccess: true},
        },
      });
      MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/',
        body: OAuthConsentFixture({
          organizationOptions: [
            {id: '1', name: 'First Org', slug: 'first-org'},
            {id: '2', name: 'Second Org', slug: 'second-org'},
          ],
        }),
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
      await waitForAuthorization();
      expect(screen.getByText(selectedName)).toBeInTheDocument();
      await userEvent.click(await waitForAuthorization());
      await waitFor(() =>
        expect(approve).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              op: 'approve',
              transactionId: 'prepared-transaction',
              selectedOrganizationId: selectedId,
            },
          })
        )
      );
    }
  );

  it('keeps application context through login and refreshes preparation', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Authentication credentials were not provided.'},
    });
    const config = MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        canRegister: true,
        hasNewsletter: false,
      },
    });
    const user = UserFixture({name: 'New Account'});
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {user, nextUri: '/elsewhere/'},
    });
    render(<OAuthAuthorize />, {
      initialRouterConfig: {
        location: {
          pathname: location.pathname,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
      },
    });
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    expect(
      screen.queryByRole('button', {name: 'Create an account'})
    ).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture({transactionId: 'after-login'}),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));
    await waitForAuthorization();
    await waitFor(() => expect(screen.getByText('New Account')).toBeVisible());
    expect(prepare).toHaveBeenCalledTimes(1);
    const next = new URL(
      config.mock.calls[0]![1].query.next,
      'https://sentry.example.com'
    );
    expect(next.pathname).toBe(location.pathname);
    expect(Object.fromEntries(next.searchParams)).toEqual(
      Object.fromEntries(new URLSearchParams(location.search))
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('shows a forbidden response instead of a login form for an authenticated account', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Not allowed'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/oauth/authorize/'},
    });
    render(<OAuthAuthorize />, {
      initialRouterConfig: {
        location: {
          pathname: location.pathname,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
      },
    });
    await waitFor(() => expect(screen.getByText('Not allowed')).toBeVisible());
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
  });

  it.each([
    {
      endpoint: '/auth/oauth/authorize/context/',
      statusCode: 400,
      message: 'Invalid application',
      showAccount: false,
    },
    {
      endpoint: '/auth/oauth/authorize/',
      statusCode: 403,
      message: 'Insufficient access',
      showAccount: true,
    },
    {
      endpoint: '/auth/oauth/authorize/',
      statusCode: 400,
      message: 'No eligible organizations',
      showAccount: true,
    },
  ])(
    'shows $message with the appropriate recovery actions',
    async ({endpoint, statusCode, message, showAccount}) => {
      MockApiClient.addMockResponse({url: endpoint, statusCode, body: {detail: message}});
      MockApiClient.addMockResponse({
        url: '/auth/config/',
        body: {nextUri: '/oauth/authorize/'},
      });
      render(<OAuthAuthorize />, {
        initialRouterConfig: {
          location: {
            ...location,
            query: Object.fromEntries(new URLSearchParams(location.search)),
          },
        },
      });
      await waitFor(() => expect(screen.getByText(message)).toBeVisible());
      expect(screen.queryByRole('button', {name: 'Start over'})).not.toBeInTheDocument();

      if (showAccount) {
        expect(screen.getByRole('button', {name: 'Switch account'})).toBeEnabled();
      } else {
        expect(screen.queryByText('With your account…')).not.toBeInTheDocument();
      }
    }
  );

  it('restarts an expired decision with a fresh transaction', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Your authorization request has expired. Please start over.'},
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    await userEvent.click(await waitForAuthorization());
    const restart = await screen.findByRole('button', {name: 'Start over'});
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture({transactionId: 'fresh-transaction'}),
    });
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {stage: 'redirect', redirectUrl: 'https://example.com/callback'},
    });
    await userEvent.click(restart);
    await userEvent.click(await waitForAuthorization());
    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {op: 'approve', transactionId: 'fresh-transaction'},
        })
      )
    );
  });

  it('shows organization access errors and offers account switching', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 400,
      body: {detail: 'You must be a member of an organization.'},
    });
    render(<OAuthAuthorize />, {
      initialRouterConfig: {
        location: {
          pathname: location.pathname,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        },
      },
    });
    await waitFor(() =>
      expect(screen.getByText('You must be a member of an organization.')).toBeVisible()
    );
    expect(screen.getByRole('button', {name: 'Switch account'})).toBeEnabled();
  });
});
