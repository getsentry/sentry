import Cookies from 'js-cookie';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import type {AuthConfig} from 'sentry/types/auth';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import AuthLogin from './index';

describe('AuthLogin', () => {
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

      expect(Cookies.get('sentry_react_auth')).toBeUndefined();
      expect(testableWindowLocation.reload).toHaveBeenCalled();
    } finally {
      Cookies.remove('sentry_react_auth', {domain: '.sentry.io', path: '/auth/'});
      setWindowLocation(originalLocation);
    }
  });

  it('renders the configured login banner', async () => {
    const authConfig: AuthConfig = {
      canRegister: true,
      githubLoginLink: '',
      googleLoginLink: '',
      hasNewsletter: false,
      loginBanner:
        'Try agent monitoring. <a href="https://example.com/agents">Learn more</a>.',
      pendingMfa: null,
      serverHostname: 'sentry.example.com',
      vstsLoginLink: '',
    };
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: authConfig,
    });

    render(<AuthLogin />);

    expect(await screen.findByRole('link', {name: 'Learn more'})).toHaveAttribute(
      'href',
      'https://example.com/agents'
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
});
