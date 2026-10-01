import {Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {focusManager} from '@tanstack/react-query';
import {MotionGlobalConfig} from 'framer-motion';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import AcceptOrganizationInvite from 'sentry/views/authV2/acceptOrganizationInvite';
import type {InviteDetails} from 'sentry/views/authV2/acceptOrganizationInvite/types';
import {mockElementFromPoint} from 'sentry/views/authV2/authLogin/components/testUtils';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';
import {BrandedAuthLoadingProvider} from 'sentry/views/authV2/useBrandedAuthLoading';

const organization = OrganizationFixture({name: 'Acme', slug: 'org-slug'});
const defaultInvite: InviteDetails = {
  existingMember: false,
  hasAuthProvider: false,
  needs2fa: false,
  needsAuthentication: false,
  orgSlug: organization.slug,
  requireSso: false,
  inviteEmail: 'invitee@example.com',
};
const defaultRouterConfig = {
  location: {pathname: '/accept/org-slug/1/abc/'},
  route: '/accept/:orgId/:memberId/:token/',
};

function mockOrganizationConfig(invite: InviteDetails = defaultInvite) {
  MockApiClient.addMockResponse({
    url: '/auth/organizations/org-slug/config/',
    body: {
      authenticated: !invite.needsAuthentication,
      canRegister: true,
      joinRequestUrl: null,
      loginMethod: invite.hasAuthProvider ? 'sso' : 'password',
      memberAuthenticated: !invite.needsAuthentication,
      organization: {
        avatarUrl: organization.avatar?.avatarUrl ?? null,
        name: organization.name,
        slug: organization.slug,
      },
      provider: invite.hasAuthProvider
        ? {key: 'saml2', name: invite.ssoProvider ?? 'SSO'}
        : null,
      ssoRequired: invite.requireSso,
      warnings: [],
    } satisfies AuthOrganization,
  });
}

function mockAuthConfig(overrides: Partial<AuthConfig> = {}, asyncDelay?: Promise<void>) {
  return MockApiClient.addMockResponse({
    url: '/auth/config/',
    asyncDelay,
    body: {
      canRegister: true,
      hasNewsletter: false,
      pendingMfa: null,
      serverHostname: 'sentry.example.com',
      ...overrides,
    } satisfies AuthConfig,
  });
}

describe('AcceptOrganizationInvite', () => {
  mockElementFromPoint();
  const configState = ConfigStore.getState();
  const skipAnimations = MotionGlobalConfig.skipAnimations;

  afterEach(() => {
    MotionGlobalConfig.skipAnimations = skipAnimations;
    ConfigStore.loadInitialData(configState);
    focusManager.setFocused(undefined);
  });

  it('shows the organization and signed-in account before accepting', async () => {
    const user = UserFixture({
      email: 'signed-in@example.com',
      name: 'Signed In User',
    });
    ConfigStore.set('user', user);
    const getInvite = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: defaultInvite,
    });
    mockOrganizationConfig();
    const accept = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'POST',
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(await screen.findByRole('heading', {name: 'Accept Invitation'})).toBeVisible();
    expect(screen.getByText('Acme')).toBeVisible();
    expect(screen.getByText('Signed In User')).toBeVisible();
    expect(screen.getByText('signed-in@example.com')).toBeVisible();
    expect(screen.getByText("You've been invited to join…")).toAppearBefore(
      screen.getByText('Acme')
    );
    expect(screen.getByText("You're joining with the account…")).toAppearBefore(
      screen.getByText('Signed In User')
    );
    expect(getInvite).toHaveBeenCalledWith(
      '/accept-invite/org-slug/1/abc/',
      expect.objectContaining({query: {acceptance: 'explicit'}})
    );

    await userEvent.click(screen.getByRole('button', {name: 'Accept invitation'}));

    expect(accept).toHaveBeenCalled();
    expect(testableWindowLocation.assign).toHaveBeenCalledWith('/org-slug/');
  });

  it('offers inline registration with the invitation email', async () => {
    const invite = {...defaultInvite, needsAuthentication: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig();

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(await screen.findByRole('button', {name: 'Create account'})).toBeVisible();
    expect(screen.getByText("You've been invited to join…")).toBeVisible();
    expect(
      screen.queryByText("You're joining with the account…")
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeVisible();
    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue(
      'invitee@example.com'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}));
    const createAccount = await screen.findByRole('button', {
      name: 'Create one',
    });
    expect(createAccount.parentElement).toHaveTextContent(
      "Don't have an account? Create one"
    );
    await userEvent.click(createAccount);
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Sign in'})).toBeVisible()
    );
  });

  it('keeps registration busy until the invitation check finishes', async () => {
    let invite = {...defaultInvite, needsAuthentication: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: () => invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig();
    const user = UserFixture({
      email: 'invitee@example.com',
      name: 'New User',
    });
    const register = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), user.name);
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    invite = {...invite, needsAuthentication: false};
    const refetchDelay = Promise.withResolvers<void>();
    const refetch = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: invite,
      asyncDelay: refetchDelay.promise,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        '/auth/register/',
        expect.objectContaining({
          data: {
            email: 'invitee@example.com',
            name: 'New User',
            password: 'a-secure-password',
          },
        })
      )
    );
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', {name: 'Create account'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue(user.name);
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();

    await act(async () => {
      refetchDelay.resolve();
      await refetchDelay.promise;
    });

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeVisible()
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('signs in inline and then asks the user to accept', async () => {
    let invite = {...defaultInvite, needsAuthentication: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: () => invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig({
      githubLoginLink: '/auth/login/github/',
      googleLoginLink: '/auth/login/google/',
      vstsLoginLink: '/auth/login/azure/',
    });
    const user = UserFixture({
      email: 'member@example.com',
      name: 'Existing User',
    });
    const login = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Sign in'}));
    expect(screen.getByRole('button', {name: 'Google'})).toHaveAttribute(
      'href',
      '/auth/login/google/'
    );
    expect(screen.getByRole('button', {name: 'GitHub'})).toHaveAttribute(
      'href',
      '/auth/login/github/'
    );
    expect(screen.getByRole('button', {name: 'Azure'})).toHaveAttribute(
      'href',
      '/auth/login/azure/'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    invite = {...invite, needsAuthentication: false};
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() => expect(login).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Existing User')).toBeVisible());
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeVisible()
    );
  });

  it('keeps sign-in busy until the invitation check finishes, then animates acceptance', async () => {
    MotionGlobalConfig.skipAnimations = false;
    const baseTheme = ThemeFixture();
    const smooth = {
      ...baseTheme.motion.framer.smooth,
      moderate: {duration: 0.16},
    };
    const framer = {...baseTheme.motion.framer, smooth};
    const theme = {...baseTheme, motion: {...baseTheme.motion, framer}};
    const invite = {...defaultInvite, needsAuthentication: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig();
    const user = UserFixture({email: 'member@example.com'});
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });

    render(
      <ThemeProvider theme={theme}>
        <AcceptOrganizationInvite />
      </ThemeProvider>,
      {initialRouterConfig: defaultRouterConfig}
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Sign in'}));
    await waitFor(() =>
      expect(screen.queryByRole('textbox', {name: 'Name'})).not.toBeInTheDocument()
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'password');

    let resolveRefetch!: () => void;
    const refetchDelay = new Promise<void>(resolve => {
      resolveRefetch = resolve;
    });
    const refetch = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: defaultInvite,
      asyncDelay: refetchDelay,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));
    await waitFor(() => expect(refetch).toHaveBeenCalled());

    expect(screen.getByRole('button', {name: 'Log in to Sentry'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue(user.email);
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveRefetch();
      await refetchDelay;
    });

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeVisible()
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps MFA busy until the invitation check finishes', async () => {
    const invite = {...defaultInvite, needsAuthentication: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig();
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Sign in'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() =>
      expect(screen.getByText('Enter the code from your Authenticator')).toBeVisible()
    );

    const user = UserFixture();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });
    const refetchDelay = Promise.withResolvers<void>();
    const refetch = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: defaultInvite,
      asyncDelay: refetchDelay.promise,
    });
    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      '123456'
    );
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Back to Login'})).toBeDisabled();

    await act(async () => {
      refetchDelay.resolve();
      await refetchDelay.promise;
    });

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeVisible()
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('uses organization SSO when it is required', async () => {
    const invite = {
      ...defaultInvite,
      hasAuthProvider: true,
      needsAuthentication: true,
      requireSso: true,
      ssoProvider: 'Okta',
    };
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: invite,
    });
    mockOrganizationConfig(invite);

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(await screen.findByRole('button', {name: 'SSO'})).toBeVisible();
    expect(screen.getByRole('button', {name: 'SSO'}).closest('form')).toHaveAttribute(
      'action',
      '/auth/login/org-slug/?next=%2Forg-slug%2F'
    );
    expect(
      screen.getByText('Sign in with the organization’s SSO provider to continue.')
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Create account'})
    ).not.toBeInTheDocument();
  });

  it('allows switching accounts when already a member', async () => {
    let invite = {...defaultInvite, existingMember: true};
    const getInvite = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: () => invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig();
    const logoutRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });
    MockApiClient.addMockResponse({
      url: '/auth-v2/csrf/',
      method: 'GET',
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(
      await screen.findByText('This account is already a member of the organization.')
    ).toBeVisible();
    const switchButtons = screen.getAllByRole('button', {
      name: 'Switch account',
    });
    invite = {...invite, existingMember: false, needsAuthentication: true};
    await userEvent.click(switchButtons.at(-1)!);

    await waitFor(() => expect(logoutRequest).toHaveBeenCalled());
    await waitFor(() => expect(getInvite).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible()
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('starts a fresh registration form after signing in and switching accounts', async () => {
    let invite = {...defaultInvite, needsAuthentication: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: () => invite,
    });
    mockOrganizationConfig(invite);
    mockAuthConfig();
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user: UserFixture()},
    });
    const logoutRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/'});

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Sign in'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    invite = {...invite, needsAuthentication: false};
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeVisible()
    );

    invite = {...invite, needsAuthentication: true};
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible()
    );
    expect(logoutRequest).toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue(
      'invitee@example.com'
    );
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('keeps the current account and allows retrying when logout fails', async () => {
    const user = UserFixture({
      name: 'Current User',
      email: 'current@example.com',
    });
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: defaultInvite,
    });
    mockOrganizationConfig();
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      statusCode: 500,
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Switch account'}));

    expect(
      await screen.findByText('Unable to switch accounts. Try again.')
    ).toBeVisible();
    expect(screen.getByText(user.email)).toBeVisible();
    expect(screen.getByRole('button', {name: 'Switch account'})).toBeEnabled();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE'});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/'});
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: {...defaultInvite, needsAuthentication: true},
    });
    mockAuthConfig();

    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible()
    );
    expect(
      screen.queryByText('Unable to switch accounts. Try again.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'keeps the previous account and action together while switching (needs2fa: %s)',
    async needs2fa => {
      const user = UserFixture({
        name: 'Previous User',
        email: 'previous@example.com',
      });
      ConfigStore.set('user', user);
      MockApiClient.addMockResponse({
        url: '/accept-invite/org-slug/1/abc/',
        method: 'GET',
        body: {...defaultInvite, needs2fa},
      });
      mockOrganizationConfig();
      mockAuthConfig();
      const logoutDelay = Promise.withResolvers<void>();
      const logoutRequest = MockApiClient.addMockResponse({
        url: '/auth/',
        method: 'DELETE',
        asyncDelay: logoutDelay.promise,
      });
      MockApiClient.addMockResponse({url: '/auth-v2/csrf/'});
      let resolveRefetch!: () => void;
      const refetchDelay = new Promise<void>(resolve => {
        resolveRefetch = resolve;
      });

      render(<AcceptOrganizationInvite />, {
        initialRouterConfig: defaultRouterConfig,
      });

      expect(await screen.findByText(user.email)).toBeVisible();
      const actionName = needs2fa ? 'Configure Two-Factor Auth' : 'Accept invitation';
      const refetch = MockApiClient.addMockResponse({
        url: '/accept-invite/org-slug/1/abc/',
        method: 'GET',
        body: {...defaultInvite, needsAuthentication: true},
        asyncDelay: refetchDelay,
      });
      await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

      await waitFor(() => expect(logoutRequest).toHaveBeenCalledTimes(1));
      expect(screen.getByText(user.email)).toBeVisible();
      expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
      expect(screen.getByRole('button', {name: actionName})).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await act(async () => {
        logoutDelay.resolve();
        await logoutDelay.promise;
      });

      await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', {name: actionName})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByText(user.email)).toBeVisible();

      await act(async () => {
        resolveRefetch();
        await refetchDelay;
      });

      expect(
        await screen.findByRole('button', {name: 'Create account'})
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText(user.email)).not.toBeInTheDocument());
    }
  );

  it('keeps the invitation visible while loading authentication after switching accounts', async () => {
    const user = UserFixture({email: 'previous@example.com'});
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: defaultInvite,
    });
    mockOrganizationConfig();
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE'});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/'});
    let resolveAuthConfig!: () => void;
    const authConfigDelay = new Promise<void>(resolve => {
      resolveAuthConfig = resolve;
    });
    const loadAuthConfig = mockAuthConfig({}, authConfigDelay);

    render(
      <BrandedAuthLoadingProvider>
        {isLoading => (
          <Fragment>
            <Container visibility={isLoading ? 'hidden' : 'visible'}>
              <AcceptOrganizationInvite />
            </Container>
            {isLoading && <Text>Loading authentication…</Text>}
          </Fragment>
        )}
      </BrandedAuthLoadingProvider>,
      {initialRouterConfig: defaultRouterConfig}
    );

    expect(await screen.findByText(user.email)).toBeVisible();
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: {...defaultInvite, needsAuthentication: true},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    await waitFor(() => expect(loadAuthConfig).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('heading', {name: 'Accept Invitation'})).toBeVisible();
    expect(screen.getByText('Acme')).toBeVisible();
    expect(screen.queryByText('Loading authentication…')).not.toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeVisible();
    expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Create account'})
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveAuthConfig();
      await authConfigDelay;
    });

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible()
    );
    expect(screen.queryByText('Loading authentication…')).not.toBeInTheDocument();
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'checks two-factor setup in the background (needs2fa: %s)',
    async needs2fa => {
      focusManager.setFocused(false);
      MockApiClient.addMockResponse({
        url: '/accept-invite/org-slug/1/abc/',
        method: 'GET',
        body: {...defaultInvite, needs2fa: true},
      });
      mockOrganizationConfig();

      render(<AcceptOrganizationInvite />, {
        initialRouterConfig: defaultRouterConfig,
      });

      expect(
        await screen.findByRole('button', {name: 'Configure Two-Factor Auth'})
      ).toBeVisible();
      const refetchDelay = Promise.withResolvers<void>();
      const getInvite = MockApiClient.addMockResponse({
        url: '/accept-invite/org-slug/1/abc/',
        method: 'GET',
        body: {...defaultInvite, needs2fa},
        asyncDelay: refetchDelay.promise,
      });

      act(() => focusManager.setFocused(true));
      await waitFor(() => expect(getInvite).toHaveBeenCalledTimes(1));
      expect(
        screen.getByRole('button', {name: 'Configure Two-Factor Auth'})
      ).toHaveAttribute('aria-disabled', 'true');
      expect(
        screen.queryByRole('button', {name: 'Accept invitation'})
      ).not.toBeInTheDocument();

      await act(async () => {
        refetchDelay.resolve();
        await refetchDelay.promise;
      });

      const actionName = needs2fa ? 'Configure Two-Factor Auth' : 'Accept invitation';
      await waitFor(() =>
        expect(screen.getByRole('button', {name: actionName})).toBeVisible()
      );
      await waitFor(() =>
        expect(screen.getByRole('button', {name: actionName})).toHaveAttribute(
          'aria-disabled',
          'false'
        )
      );
    }
  );

  it('prompts the user to configure required two-factor authentication', async () => {
    const invite = {...defaultInvite, needs2fa: true};
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: invite,
    });
    mockOrganizationConfig(invite);

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(
      await screen.findByRole('button', {name: 'Configure Two-Factor Auth'})
    ).toBeVisible();
  });

  it('allows retrying organization configuration while retaining the invitation heading', async () => {
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: defaultInvite,
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/org-slug/config/',
      statusCode: 503,
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(
      await screen.findByText('Unable to load this invitation. Try again.')
    ).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Accept Invitation'})).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();

    mockOrganizationConfig();
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    expect(await screen.findByRole('button', {name: 'Accept invitation'})).toBeVisible();
  });

  it.each([429, 503])(
    'allows retrying an invitation load failure (%s)',
    async statusCode => {
      MockApiClient.addMockResponse({
        url: '/accept-invite/org-slug/1/abc/',
        statusCode,
      });
      mockOrganizationConfig();

      render(<AcceptOrganizationInvite />, {
        initialRouterConfig: defaultRouterConfig,
      });

      expect(
        await screen.findByText('Unable to load this invitation. Try again.')
      ).toBeVisible();
      expect(
        screen.queryByText(/invitation is invalid or expired/)
      ).not.toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: '/accept-invite/org-slug/1/abc/',
        body: defaultInvite,
      });
      await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

      expect(
        await screen.findByRole('button', {name: 'Accept invitation'})
      ).toBeVisible();
    }
  );

  it('allows retrying a failed refresh after two-factor setup', async () => {
    focusManager.setFocused(false);
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: {...defaultInvite, needs2fa: true},
    });
    mockOrganizationConfig();

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await screen.findByRole('button', {name: 'Configure Two-Factor Auth'});
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      statusCode: 503,
    });
    act(() => focusManager.setFocused(true));

    expect(
      await screen.findByText('Unable to load this invitation. Try again.')
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: defaultInvite,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    expect(await screen.findByRole('button', {name: 'Accept invitation'})).toBeVisible();
  });

  it('keeps the logged-out account hidden when refreshing the invitation fails', async () => {
    const user = UserFixture({email: 'previous@example.com'});
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: defaultInvite,
    });
    mockOrganizationConfig();
    mockAuthConfig();
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE'});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/'});

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(await screen.findByText(user.email)).toBeVisible();
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      statusCode: 503,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

    expect(
      await screen.findByText('Unable to load this invitation. Try again.')
    ).toBeVisible();
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      body: {...defaultInvite, needsAuthentication: true},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible()
    );
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });

  it('allows retrying a failed invitation acceptance', async () => {
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      body: defaultInvite,
    });
    mockOrganizationConfig();
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'POST',
      statusCode: 500,
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Accept invitation'}));

    expect(
      await screen.findByText('Failed to accept this invitation. Please try again.')
    ).toBeVisible();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeEnabled();

    const accept = MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'POST',
    });
    await userEvent.click(screen.getByRole('button', {name: 'Accept invitation'}));

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith('/org-slug/')
    );
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it('shows an invalid invitation error and account switch action', async () => {
    MockApiClient.addMockResponse({
      url: '/accept-invite/org-slug/1/abc/',
      method: 'GET',
      statusCode: 400,
      body: {detail: 'Invalid invite'},
    });

    render(<AcceptOrganizationInvite />, {
      initialRouterConfig: defaultRouterConfig,
    });

    expect(await screen.findByText(/invitation is invalid or expired/)).toBeVisible();
    const logoutRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });
    MockApiClient.addMockResponse({
      url: '/auth-v2/csrf/',
      method: 'GET',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    await waitFor(() => expect(logoutRequest).toHaveBeenCalled());
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });
});
