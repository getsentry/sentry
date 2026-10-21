import {OAuthConsentFixture, OAuthContextFixture} from 'sentry-fixture/oauth';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {mockElementFromPoint} from 'sentry/views/authV2/authLogin/components/testUtils';
import OAuthDevice from 'sentry/views/authV2/oauthDevice';

import OAuthAuthorize from '.';

const location = {
  pathname: '/oauth/authorize/',
  query: {client_id: 'example-client', response_type: 'code'},
};
const loginConfig = {
  pendingMfa: null,
  serverHostname: 'sentry.example.com',
  canRegister: false,
  hasNewsletter: false,
};

describe('OAuth account authentication', () => {
  mockElementFromPoint();
  const originalConfig = ConfigStore.getState();
  beforeEach(() => {
    ConfigStore.set('user', UserFixture({name: 'Original Account'}));
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/context/',
      body: OAuthContextFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture(),
    });
  });
  afterEach(() => ConfigStore.loadInitialData(originalConfig));

  it.each([
    {
      name: 'browser',
      Component: OAuthAuthorize,
      contextUrl: '/auth/oauth/authorize/context/',
      consentUrl: '/auth/oauth/authorize/',
      route: location,
      prepared: OAuthConsentFixture(),
      context: OAuthContextFixture(),
    },
    {
      name: 'device',
      Component: OAuthDevice,
      contextUrl: '/auth/oauth/device/context/',
      consentUrl: '/auth/oauth/device/',
      route: {pathname: '/oauth/device/', query: {user_code: 'ABCD-EFGH'}},
      prepared: {stage: 'consent', userCode: 'ABCD-EFGH', organizationOptions: []},
      context: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
    },
  ])(
    'keeps $name consent disabled until authentication is ready',
    async ({Component, contextUrl, consentUrl, route, prepared, context}) => {
      MockApiClient.addMockResponse({url: contextUrl, body: context});
      MockApiClient.addMockResponse({url: consentUrl, body: prepared});
      const logoutDelay = Promise.withResolvers<void>();
      const configDelay = Promise.withResolvers<void>();
      MockApiClient.addMockResponse({
        url: '/auth/',
        method: 'DELETE',
        asyncDelay: logoutDelay.promise,
      });
      MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
      const configRequest = MockApiClient.addMockResponse({
        url: '/auth/config/',
        body: loginConfig,
        asyncDelay: configDelay.promise,
      });
      const decide = MockApiClient.addMockResponse({
        url: consentUrl,
        method: 'POST',
        body: {},
      });
      render(<Component />, {initialRouterConfig: {location: route}});
      expect(await screen.findByRole('button', {name: 'Authorize'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
      await waitFor(() => expect(screen.getByText('Original Account')).toBeVisible());
      expect(screen.getByRole('button', {name: 'Authorize'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Authorize'})).not.toHaveAttribute(
        'aria-busy',
        'true'
      );
      expect(screen.getByRole('button', {name: 'Deny'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
      await act(() => {
        logoutDelay.resolve();
        return logoutDelay.promise;
      });
      await waitFor(() => expect(configRequest).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Original Account')).toBeVisible());
      expect(screen.getByRole('button', {name: 'Authorize'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Authorize'})).not.toHaveAttribute(
        'aria-busy',
        'true'
      );
      expect(screen.getByRole('button', {name: 'Deny'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
      await userEvent.click(screen.getByRole('button', {name: 'Authorize'}));
      expect(decide).not.toHaveBeenCalled();
      await act(() => {
        configDelay.resolve();
        return configDelay.promise;
      });
      await waitFor(() =>
        expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible()
      );
      await waitFor(() =>
        expect(screen.queryByText('Original Account')).not.toBeInTheDocument()
      );
      await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    }
  );

  it('keeps consent disabled and allows retry when auth configuration fails after logout', async () => {
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      statusCode: 500,
      body: {detail: 'Unable to load sign-in.'},
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Authorize'})).toBeVisible()
    );
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    expect(await screen.findByText('Unable to load sign-in.')).toBeVisible();
    expect(screen.getByText('Original Account')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Authorize'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeDisabled();
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible()
    );
  });

  it.each([
    {
      name: 'browser',
      Component: OAuthAuthorize,
      contextUrl: '/auth/oauth/authorize/context/',
      consentUrl: '/auth/oauth/authorize/',
      route: location,
      context: OAuthContextFixture(),
      prepared: OAuthConsentFixture(),
    },
    {
      name: 'device',
      Component: OAuthDevice,
      contextUrl: '/auth/oauth/device/context/',
      consentUrl: '/auth/oauth/device/',
      route: {pathname: '/oauth/device/', query: {user_code: 'ABCD-EFGH'}},
      context: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
      prepared: {stage: 'consent', userCode: 'ABCD-EFGH', organizationOptions: []},
    },
  ])(
    'keeps $name sign-in busy until organization consent is ready',
    async ({Component, contextUrl, consentUrl, route, context, prepared}) => {
      MockApiClient.addMockResponse({
        url: contextUrl,
        body: {
          ...context,
          application: {...context.application, requiresOrgLevelAccess: true},
        },
      });
      MockApiClient.addMockResponse({
        url: consentUrl,
        statusCode: 403,
        body: {detail: 'Authentication required.'},
      });
      MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
      MockApiClient.addMockResponse({
        url: '/auth/login/',
        method: 'POST',
        body: {user: UserFixture({id: '2', name: 'New Account'}), nextUri: '/elsewhere/'},
      });
      render(<Component />, {initialRouterConfig: {location: route}});
      await userEvent.type(
        await screen.findByRole('textbox', {name: 'Email'}),
        'new@example.com'
      );
      await userEvent.type(screen.getByLabelText('Password'), 'password');
      const delay = Promise.withResolvers<void>();
      const prepare = MockApiClient.addMockResponse({
        url: consentUrl,
        body: {
          ...prepared,
          organizationOptions: [{id: '1', name: 'New Org', slug: 'new-org'}],
        },
        asyncDelay: delay.promise,
      });
      await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));
      await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('new@example.com');
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Log in to Sentry'})).toBeDisabled();
      expect(screen.queryByText('New Account')).not.toBeInTheDocument();
      expect(screen.queryByText('With access only to…')).not.toBeInTheDocument();
      expect(screen.getByText('Example Application')).toBeVisible();
      await act(() => {
        delay.resolve();
        return delay.promise;
      });
      await waitFor(() => expect(screen.getByText('New Org')).toBeVisible());
      expect(screen.getByText('New Account')).toBeVisible();
      expect(screen.getByRole('button', {name: 'Authorize'})).toBeEnabled();
      expect(prepare).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps consent visible until organization sign-in configuration is ready', async () => {
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {...loginConfig, singleOrganizationSlug: 'org-slug'},
    });
    const delay = Promise.withResolvers<void>();
    const organizationRequest = MockApiClient.addMockResponse({
      url: '/auth/organizations/org-slug/config/',
      body: {
        organization: {name: 'Example Org', slug: 'org-slug', avatarUrl: null},
        provider: null,
        loginMethod: 'password',
        ssoRequired: false,
      },
      asyncDelay: delay.promise,
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Switch account'})).toBeVisible()
    );
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    await waitFor(() => expect(organizationRequest).toHaveBeenCalled());
    expect(screen.getByText('Original Account')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Authorize'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeDisabled();
    await act(() => {
      delay.resolve();
      return delay.promise;
    });
    await waitFor(() => expect(screen.getByText('Example Org')).toBeVisible());
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible()
    );
  });

  it('refreshes account-bound consent after logout and login', async () => {
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
          {id: '1', name: 'Old Org', slug: 'old-org'},
          {id: '2', name: 'Other Org', slug: 'other-org'},
        ],
      }),
    });
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {user: UserFixture({id: '2', name: 'New Account'}), nextUri: '/elsewhere/'},
    });
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {stage: 'redirect', redirectUrl: 'https://example.com/callback'},
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    expect(await screen.findByRole('button', {name: 'Authorize'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Change'}));
    await userEvent.click(await screen.findByText('Old Org (old-org)'));
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Authentication credentials were not provided.'},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Email'}),
      'new@example.com'
    );
    expect(screen.queryByText('Original Account')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture({
        transactionId: 'new-account-transaction',
        organizationOptions: [
          {id: '3', name: 'New Org', slug: 'new-org'},
          {id: '4', name: 'Another Org', slug: 'another-org'},
        ],
      }),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));
    expect(await screen.findByRole('button', {name: 'Authorize'})).toBeEnabled();
    await waitFor(() => expect(screen.getByText('New Account')).toBeVisible());
    await userEvent.click(screen.getByRole('button', {name: 'Change'}));
    await userEvent.click(await screen.findByText('New Org (new-org)'));
    await userEvent.click(screen.getByRole('button', {name: 'Authorize'}));
    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            op: 'approve',
            transactionId: 'new-account-transaction',
            selectedOrganizationId: '3',
          },
        })
      )
    );
  });

  it('keeps the current consent available when logout fails', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      statusCode: 500,
      body: {detail: 'Unable to sign out.'},
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    await userEvent.click(await screen.findByRole('button', {name: 'Switch account'}));
    await waitFor(() => expect(screen.getByText('Unable to sign out.')).toBeVisible());
    await waitFor(() => expect(screen.getByText('Original Account')).toBeVisible());
    expect(screen.getByRole('button', {name: 'Authorize'})).toBeEnabled();
  });

  it('prevents logout while an approval is in flight', async () => {
    const delay = Promise.withResolvers<void>();
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      asyncDelay: delay.promise,
      body: {stage: 'redirect', redirectUrl: 'https://example.com/callback'},
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    await userEvent.click(await screen.findByRole('button', {name: 'Authorize'}));
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
    act(() => delay.resolve());
  });

  it('keeps the request visible through MFA and prepares fresh consent', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Authentication credentials were not provided.'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {...loginConfig, pendingMfa: {mfaRequired: true, mfaMethods: [{id: 'totp'}]}},
    });
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {user: UserFixture(), nextUri: '/elsewhere/'},
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    const input = await screen.findByRole('textbox', {name: 'One-time password'});
    await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture({transactionId: 'after-mfa'}),
    });
    await userEvent.type(input, '123456');
    expect(await screen.findByRole('button', {name: 'Authorize'})).toBeEnabled();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('preserves the OAuth destination in the organization SSO form', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Authentication credentials were not provided.'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {...loginConfig, singleOrganizationSlug: 'org-slug'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/org-slug/config/',
      body: {
        organization: {name: 'Example Org', slug: 'org-slug', avatarUrl: null},
        provider: {key: 'saml2', name: 'SAML'},
        loginMethod: 'sso',
        ssoRequired: true,
      },
    });
    render(<OAuthAuthorize />, {initialRouterConfig: {location}});
    const sso = await screen.findByRole('button', {name: 'SSO'});
    const form = sso.closest('form');
    expect(form).toHaveAttribute('method', 'POST');
    const action = new URL(form!.getAttribute('action')!, 'https://sentry.example.com');
    expect(action.pathname).toBe('/auth/login/org-slug/');
    const next = new URL(action.searchParams.get('next')!, 'https://sentry.example.com');
    expect(next.pathname).toBe('/oauth/authorize/');
    expect(next.searchParams.get('client_id')).toBe('example-client');
  });
});
