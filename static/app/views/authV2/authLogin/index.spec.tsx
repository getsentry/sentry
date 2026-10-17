import {Fragment} from 'react';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import type {AuthenticatedResult} from 'sentry/views/authV2/authLogin/types';
import {BrandedAuthLoadingProvider} from 'sentry/views/authV2/useBrandedAuthLoading';

import AuthLogin from './index';

jest.mock('sentry/utils/analytics');

describe('AuthLogin', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => null),
    });
  });

  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
    ConfigStore.set('singleOrganization', false);
  });

  afterAll(() => {
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  function mockAuthConfig(singleOrganizationSlug?: string) {
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
        ...(singleOrganizationSlug ? {singleOrganizationSlug} : {}),
      } satisfies AuthConfig,
    });
  }

  function mockDemoOrganizationConfig() {
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: '/join-request/acme/',
        loginMethod: 'demo',
        ssoRequired: false,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: null,
        warnings: [],
      },
    });
  }

  function mockFocusedPasswordOrganization(warnings: string[]) {
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
        loginMethod: 'password',
        ssoRequired: false,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: null,
        warnings,
      },
    });
  }

  function renderFocusedPasswordOrganization() {
    return render(<AuthLogin />, {
      initialRouterConfig: {
        location: {
          pathname: '/auth/login/acme/',
          query: {next: '/organizations/acme/issues/?query=is:unresolved'},
        },
        route: '/auth/login/:orgSlug/',
      },
    });
  }

  function syncOrganizationLoginLocation(router: {
    location: {pathname: string; search: string};
  }) {
    setWindowLocation(
      `http://localhost${router.location.pathname}${router.location.search}`
    );
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    expect(returnUrl).toBe(`${router.location.pathname}${router.location.search}`);
    return returnUrl;
  }

  function renderWithLoadingState() {
    return render(
      <BrandedAuthLoadingProvider>
        {isLoading => (
          <Fragment>
            <div>{isLoading ? 'Loading authentication' : 'Authentication ready'}</div>
            <AuthLogin />
          </Fragment>
        )}
      </BrandedAuthLoadingProvider>
    );
  }

  it('does not render the sign-in flow while auth config is loading', async () => {
    const authConfig = Promise.withResolvers<AuthConfig>();
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: () => authConfig.promise,
    });

    renderWithLoadingState();

    expect(screen.getByText('Loading authentication')).toBeInTheDocument();
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
    expect(screen.getByText('Authentication ready')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
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

    renderWithLoadingState();

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

    renderWithLoadingState();

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        '/organizations/acme/issues/'
      )
    );
    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Loading authentication')).toBeInTheDocument();
  });

  it('replaces the generic login route and shows password auth for a single org', async () => {
    ConfigStore.set('singleOrganization', true);
    mockAuthConfig('sentry');
    MockApiClient.addMockResponse({
      url: '/auth/organizations/sentry/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'password',
        ssoRequired: false,
        organization: {avatarUrl: null, name: 'Sentry', slug: 'sentry'},
        provider: null,
        warnings: [],
      },
    });

    const {router} = render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/'},
        route: '/auth/login/:orgSlug?/',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Sentry')).toBeVisible();
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible();
      expect(screen.getByLabelText('Password')).toBeVisible();
    });
    expect(router.location.pathname).toBe('/auth/login/sentry/');
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', {name: 'Clear organization login context'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('shows both SSO and password auth when SSO is optional for a single org', async () => {
    ConfigStore.set('singleOrganization', true);
    mockAuthConfig('sentry');
    MockApiClient.addMockResponse({
      url: '/auth/organizations/sentry/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: false,
        organization: {avatarUrl: null, name: 'Sentry', slug: 'sentry'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/sentry/'},
        route: '/auth/login/:orgSlug?/',
      },
    });

    expect(await screen.findByRole('textbox', {name: 'Email'})).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(screen.getByRole('button', {name: 'SSO'})).toBeEnabled();
    expect(
      screen.queryByRole('button', {name: 'Clear organization login context'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('offers password auth to an authenticated user without single-org access', async () => {
    ConfigStore.set('singleOrganization', true);
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {nextUri: '/organizations/sentry/issues/'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/sentry/config/',
      body: {
        authenticated: true,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'password',
        ssoRequired: false,
        organization: {avatarUrl: null, name: 'Sentry', slug: 'sentry'},
        provider: null,
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/sentry/'},
        route: '/auth/login/:orgSlug?/',
      },
    });

    expect(await screen.findByRole('textbox', {name: 'Email'})).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', {name: 'Clear organization login context'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('requires SSO without offering another org in single-org mode', async () => {
    ConfigStore.set('singleOrganization', true);
    mockAuthConfig('sentry');
    MockApiClient.addMockResponse({
      url: '/auth/organizations/sentry/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Sentry', slug: 'sentry'},
        provider: {key: 'saml2', name: 'SAML'},
        warnings: [],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/sentry/'},
        route: '/auth/login/:orgSlug?/',
      },
    });

    expect(await screen.findByRole('button', {name: 'SSO'})).toBeEnabled();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Wrong organization'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('authenticates a demo organization before rendering the sign-in flow', async () => {
    const demoLogin = Promise.withResolvers<AuthenticatedResult>();
    mockAuthConfig();
    mockDemoOrganizationConfig();
    const request = MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/demo/',
      method: 'POST',
      body: () => demoLogin.promise,
    });

    render(
      <BrandedAuthLoadingProvider>
        {isLoading => (
          <Fragment>
            <div>{isLoading ? 'Loading authentication' : 'Authentication ready'}</div>
            <AuthLogin />
          </Fragment>
        )}
      </BrandedAuthLoadingProvider>,
      {
        initialRouterConfig: {
          location: {pathname: '/auth/login/acme/'},
          route: '/auth/login/:orgSlug/',
        },
      }
    );

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith(
      '/auth/organizations/acme/demo/',
      expect.objectContaining({
        method: 'POST',
        data: {nextUri: null},
      })
    );
    expect(screen.getByText('Loading authentication')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();

    act(() => {
      demoLogin.resolve({
        nextUri: '/organizations/acme/issues/',
        user: UserFixture(),
      });
    });

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        '/organizations/acme/issues/'
      )
    );
    expect(screen.getByText('Loading authentication')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Sign in to Sentry'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('uses the existing MFA flow for demo authentication', async () => {
    mockAuthConfig();
    mockDemoOrganizationConfig();
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/demo/',
      method: 'POST',
      statusCode: 202,
      body: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    expect(await screen.findByRole('textbox', {name: 'One-time password'})).toBeVisible();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('renders the error boundary when demo authentication fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthConfig();
    mockDemoOrganizationConfig();
    const request = MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/demo/',
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Demo login unavailable'},
    });

    render(
      <ErrorBoundary>
        <AuthLogin />
      </ErrorBoundary>,
      {
        initialRouterConfig: {
          location: {pathname: '/auth/login/acme/'},
          route: '/auth/login/:orgSlug/',
        },
      }
    );

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('error-boundary')).toBeVisible();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
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
    expect(
      screen.queryByRole('button', {name: 'Clear organization login context'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', {name: 'Create an account'})).toHaveAttribute(
      'href',
      '/auth/register/'
    );
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('shows a membership warning and account switch for a signed-in non-member', async () => {
    mockFocusedPasswordOrganization([
      'Your account (ada@example.com) is not a member of the Acme organization.',
    ]);

    renderFocusedPasswordOrganization();

    expect(
      await screen.findByText(
        'Your account (ada@example.com) is not a member of the Acme organization.'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('button', {name: 'Sign in with a different account'})
    ).toBeEnabled();
    expect(screen.getByRole('button', {name: 'SSO'})).toBeDisabled();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('returns to the same organization login after switching accounts', async () => {
    mockFocusedPasswordOrganization([
      'Your account (ada@example.com) is not a member of the Acme organization.',
    ]);
    const logoutRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    const {router} = renderFocusedPasswordOrganization();
    const returnUrl = syncOrganizationLoginLocation(router);

    expect(decodeURIComponent(returnUrl)).toContain(
      '/organizations/acme/issues/?query=is:unresolved'
    );
    await userEvent.click(
      await screen.findByRole('button', {name: 'Sign in with a different account'})
    );

    await waitFor(() => expect(logoutRequest).toHaveBeenCalledTimes(1));
    expect(logoutRequest).toHaveBeenCalledWith(
      '/auth/',
      expect.objectContaining({method: 'DELETE'})
    );
    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(returnUrl);
    expect(testableWindowLocation.assign).not.toHaveBeenCalledWith(
      '/organizations/acme/issues/'
    );
  });

  it('shows password authentication after reloading the anonymous organization login', async () => {
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
    const loginRequest = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: 'https://acme.sentry.io/issues/', user: UserFixture()},
    });

    const {router} = renderFocusedPasswordOrganization();
    syncOrganizationLoginLocation(router);

    expect(await screen.findByRole('textbox', {name: 'Email'})).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() => expect(loginRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://acme.sentry.io/issues/'
      )
    );
  });

  it('ignores repeated account switches while logout is in progress', async () => {
    mockFocusedPasswordOrganization([
      'Your account (ada@example.com) is not a member of the Acme organization.',
    ]);
    const logoutDelay = Promise.withResolvers<void>();
    const logoutRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      asyncDelay: logoutDelay.promise,
    });

    const {router} = renderFocusedPasswordOrganization();
    const returnUrl = syncOrganizationLoginLocation(router);
    const switchAccount = await screen.findByRole('button', {
      name: 'Sign in with a different account',
    });
    await userEvent.click(switchAccount);

    await waitFor(() => expect(logoutRequest).toHaveBeenCalledTimes(1));
    expect(switchAccount).toBeDisabled();
    expect(switchAccount).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(switchAccount);
    expect(logoutRequest).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    await act(async () => {
      logoutDelay.resolve();
      await logoutDelay.promise;
    });

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(returnUrl)
    );
    expect(logoutRequest).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable error when switching accounts fails', async () => {
    mockFocusedPasswordOrganization([
      'Your account (ada@example.com) is not a member of the Acme organization.',
    ]);
    const logoutRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      statusCode: 500,
      body: {detail: 'Logout failed'},
    });

    const {router} = renderFocusedPasswordOrganization();
    const returnUrl = syncOrganizationLoginLocation(router);
    await userEvent.click(
      await screen.findByRole('button', {name: 'Sign in with a different account'})
    );

    expect(
      await screen.findByText('Unable to sign in with a different account. Try again.')
    ).toBeVisible();
    expect(
      screen.getByRole('button', {name: 'Sign in with a different account'})
    ).toBeEnabled();
    expect(logoutRequest).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    const retryLogout = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });
    await userEvent.click(
      screen.getByRole('button', {name: 'Sign in with a different account'})
    );

    await waitFor(() => expect(retryLogout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(returnUrl)
    );
    expect(logoutRequest).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Unable to sign in with a different account. Try again.')
    ).not.toBeInTheDocument();
  });

  it('follows the single logout provider instead of the organization login', async () => {
    mockFocusedPasswordOrganization([
      'Your account (ada@example.com) is not a member of the Acme organization.',
    ]);
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      body: {sloUrl: 'https://idp.example.com/logout'},
    });

    const {router} = renderFocusedPasswordOrganization();
    const returnUrl = syncOrganizationLoginLocation(router);
    await userEvent.click(
      await screen.findByRole('button', {name: 'Sign in with a different account'})
    );

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://idp.example.com/logout'
      )
    );
    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).not.toHaveBeenCalledWith(returnUrl);
  });

  it('renders organization warnings as text with the login banner', async () => {
    const membershipWarning =
      'Your account (ada@example.com) is not a member of the <b>Acme</b> organization.';
    const sessionWarning =
      'Read the [docs](https://example.com/docs) before trying again.';
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
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
      } satisfies AuthConfig,
    });
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
        warnings: [membershipWarning, sessionWarning],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    const membership = await screen.findByText(membershipWarning);
    const session = screen.getByText(sessionWarning);
    const genericWarning = screen.getByText('Your session has expired.');
    const bannerLink = screen.getByRole('link', {name: 'Learn more'});

    expect(membership.compareDocumentPosition(session)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(session.compareDocumentPosition(genericWarning)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(genericWarning.compareDocumentPosition(bannerLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.queryByRole('link', {name: 'docs'})).not.toBeInTheDocument();
    expect(document.querySelector('b')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sign in with a different account'})
    ).not.toBeInTheDocument();
  });

  it('renders a session warning shared by both login configs once', async () => {
    const sessionExpired = 'Your session has expired.';
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
        warning: sessionExpired,
      } satisfies AuthConfig,
    });
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
        warnings: [sessionExpired],
      },
    });

    render(<AuthLogin />, {
      initialRouterConfig: {
        location: {pathname: '/auth/login/acme/'},
        route: '/auth/login/:orgSlug/',
      },
    });

    expect(await screen.findByText(sessionExpired)).toBeInTheDocument();
    expect(screen.getAllByText(sessionExpired)).toHaveLength(1);
  });

  it('does not render alerts for an empty organization warning list', async () => {
    mockFocusedPasswordOrganization([]);

    renderFocusedPasswordOrganization();

    expect(
      await screen.findByRole('button', {name: 'Sign in with a different account'})
    ).toBeEnabled();
    expect(document.querySelectorAll('.ref-warning')).toHaveLength(0);
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
  });
});
