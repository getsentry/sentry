import Cookies from 'js-cookie';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import type {AuthConfig} from 'sentry/types/auth';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import AuthLogin from './index';

jest.mock('sentry/utils/analytics');

describe('AuthLogin', () => {
  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
  });

  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => null),
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  function mockAuthConfig() {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '',
        googleLoginLink: '',
        hasNewsletter: false,
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '',
      } satisfies AuthConfig,
    });
  }

  it('does not render the sign-in flow while auth config is loading', async () => {
    const authConfig = Promise.withResolvers<AuthConfig>();
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: () => authConfig.promise,
    });

    render(<AuthLogin />);

    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Organization SSO'})
    ).not.toBeInTheDocument();

    act(() => {
      authConfig.resolve({
        canRegister: true,
        githubLoginLink: '',
        googleLoginLink: '',
        hasNewsletter: false,
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '',
      });
    });

    expect(
      await screen.findByRole('heading', {name: 'Sign in to Sentry'})
    ).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'auth.login.rendered',
      {
        organization: null,
        entrypoint: 'generic',
        state: 'login',
      },
      {startSession: true}
    );
  });

  it('shows a retry when the initial auth config request fails', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/auth/config/',
      statusCode: 503,
      body: {detail: 'Config unavailable'},
    });

    render(<AuthLogin />);

    expect(
      await screen.findByText('Unable to load the login page. Try again.')
    ).toBeVisible();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('redirects when the auth config only contains a next URI', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/organizations/acme/issues/'},
    });

    render(<AuthLogin />);

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        '/organizations/acme/issues/'
      )
    );
    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
  });

  it('focuses organization SSO when the authenticated user still requires it', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/organizations/acme/issues/'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: true,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'SSO'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Account Settings'})).toHaveAttribute(
      'href',
      'https://sentry.io/settings/account/'
    );
    expect(
      screen.queryByRole('button', {name: 'Clear organization login context'})
    ).not.toBeInTheDocument();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('redirects when the authenticated user can access the organization', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/organizations/acme/issues/'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: true,
        memberAuthenticated: true,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        '/organizations/acme/issues/'
      )
    );
    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
  });

  it('redirects when the authenticated organization is not found', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/organizations/acme/issues/'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      statusCode: 404,
      body: {detail: 'Organization not found'},
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        '/organizations/acme/issues/'
      )
    );
    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
  });

  it('shows a retry when the authenticated organization lookup fails', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/organizations/acme/issues/'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      statusCode: 503,
      body: {detail: 'Provider unavailable'},
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    expect(
      await screen.findByText(
        'Unable to load organization authentication. Please try again.'
      )
    ).toBeVisible();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeEnabled();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
  });

  it('renders authentication providers from the auth config', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '/identity/login/github/',
        googleLoginLink: '/identity/login/google/',
        hasNewsletter: false,
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '/identity/login/vsts/',
      } satisfies AuthConfig,
    });

    render(<AuthLogin />);

    expect(await screen.findByRole('button', {name: 'Google'})).toHaveAttribute(
      'href',
      '/identity/login/google/'
    );
    expect(screen.getByRole('button', {name: 'GitHub'})).toHaveAttribute(
      'href',
      '/identity/login/github/'
    );
    expect(screen.getByRole('button', {name: 'Azure'})).toHaveAttribute(
      'href',
      '/identity/login/vsts/'
    );
  });

  it('returns to the legacy login experience', async () => {
    const originalLocation = window.location.href;
    setWindowLocation('https://login.sentry.io/auth/login/');
    Cookies.set('sentry_react_auth', '1', {
      domain: '.sentry.io',
      path: '/auth/',
    });
    mockAuthConfig();

    try {
      render(
        <BrandPageLayout>
          <BrandPageLayout.Content>
            <AuthLogin />
          </BrandPageLayout.Content>
        </BrandPageLayout>
      );

      expect(await screen.findByText('New Experience')).toBeVisible();
      await userEvent.click(
        screen.getByRole('button', {name: 'Return to the old login experience'})
      );

      expect(Cookies.get('sentry_react_auth')).toBe('0');
      expect(testableWindowLocation.reload).toHaveBeenCalled();
    } finally {
      Cookies.remove('sentry_react_auth', {domain: '.sentry.io', path: '/'});
      Cookies.remove('sentry_react_auth', {domain: '.sentry.io', path: '/auth/'});
      setWindowLocation(originalLocation);
    }
  });

  it('renders warnings above the configured login banner', async () => {
    const authConfig: AuthConfig = {
      canRegister: true,
      githubLoginLink: '',
      googleLoginLink: '',
      hasNewsletter: false,
      loginBannerMarkdown:
        'Try agent monitoring. [Learn more](https://example.com/agents).',
      pendingMfa: null,
      serverHostname: 'sentry.example.com',
      vstsLoginLink: '',
      warning: 'Your session has expired.',
    };
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: authConfig,
    });

    render(<AuthLogin />);

    const warning = await screen.findByText('Your session has expired.');
    const bannerLink = screen.getByRole('link', {name: 'Learn more'});

    expect(bannerLink).toHaveAttribute('href', 'https://example.com/agents');
    expect(warning.compareDocumentPosition(bannerLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('does not render a banner without banner configuration', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '',
        googleLoginLink: '',
        hasNewsletter: false,
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '',
      } satisfies AuthConfig,
    });

    render(<AuthLogin />);

    expect(await screen.findByRole('heading', {name: 'Sign in to Sentry'})).toBeVisible();
    expect(screen.queryByRole('link', {name: 'Learn more'})).not.toBeInTheDocument();
  });

  it('replaces organization lookup with the organization context', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '',
        googleLoginLink: '',
        hasNewsletter: false,
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '',
      } satisfies AuthConfig,
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: '/join-request/acme/',
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });
    const {router} = render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/'},
        route: '/auth/login/:orgSlug?/',
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Organization SSO'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Organization Slug'}),
      'acme'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Organization SSO'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'SSO'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', {name: 'More information'}));
    expect(
      await screen.findByText(
        'This organization requires SSO authentication. You may still log in with an email and password to access other organizations and account settings.'
      )
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Wrong organization'}));
    expect(router.location.pathname).toBe('/auth/login/');
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Organization SSO'})).toBeVisible()
    );
    expect(
      screen.queryByRole('textbox', {name: 'Organization Slug'})
    ).not.toBeInTheDocument();
  });

  it('performs a full-page navigation after password authentication', async () => {
    mockAuthConfig();
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'password',
        ssoRequired: false,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: null,
        warnings: [],
      },
    });
    const request = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: 'https://acme.sentry.io/issues/', user: UserFixture()},
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/auth/login/',
        expect.objectContaining({
          method: 'POST',
          data: {username: 'user@example.com', password: 'secret', orgSlug: 'acme'},
        })
      )
    );
    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://acme.sentry.io/issues/'
      )
    );
  });

  it('performs a full-page navigation after second-factor authentication', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '/identity/login/github/',
        googleLoginLink: '/identity/login/google/',
        hasNewsletter: false,
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '/identity/login/vsts/',
      } satisfies AuthConfig,
    });
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 202,
      body: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
    });
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {nextUri: '/organizations/acme/issues/', user: UserFixture()},
    });

    render(<AuthLogin />);

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    const otpInput = await screen.findByRole('textbox', {name: 'One-time password'});
    expect(screen.queryByRole('button', {name: 'Google'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'GitHub'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Azure'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Organization SSO'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();

    await userEvent.type(otpInput, '123456');

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        '/organizations/acme/issues/'
      )
    );
  });

  it('resumes a pending second-factor authentication', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '',
        googleLoginLink: '',
        hasNewsletter: false,
        pendingMfa: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '',
      },
    });

    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: '/join-request/acme/',
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    expect(await screen.findByRole('textbox', {name: 'One-time password'})).toBeVisible();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'SSO'})).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
  });

  it('returns to login when auth config fails to refetch after cancellation', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        canRegister: true,
        githubLoginLink: '',
        googleLoginLink: '',
        hasNewsletter: false,
        pendingMfa: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
        serverHostname: 'sentry.example.com',
        vstsLoginLink: '',
      },
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/'},
        route: '/auth/login/:orgSlug?/',
      },
    });

    const cancelRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 204,
    });
    const configRefetch = MockApiClient.addMockResponse({
      url: '/auth/config/',
      statusCode: 503,
      body: {detail: 'Config unavailable'},
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Back to Login'}));
    await waitFor(() => expect(cancelRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible()
    );
    await waitFor(() => expect(configRefetch).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', {name: 'Organization SSO'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Organization Slug'}),
      'acme'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'SSO'})).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'One-time password'})
    ).not.toBeInTheDocument();
  });
});
