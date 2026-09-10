import fetchMock from 'jest-fetch-mock';
import Cookies from 'js-cookie';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {AuthenticatedApiErrorHandler} from 'sentry/views/app/authenticatedApiErrorHandler';

jest.unmock('sentry/api');

const organizationSlug = 'acme';

async function requestSsoRequired(client: Client) {
  const completed = Promise.withResolvers<void>();

  fetchMock.mockResponseOnce(
    JSON.stringify({
      detail: {
        code: 'sso-required',
        extra: {
          loginUrl: `/auth/login/${organizationSlug}/`,
          organizationSlug,
        },
        message: 'Must login via SSO',
      },
    }),
    {status: 401}
  );

  client.request('/organizations/acme/issues/', {
    complete: () => completed.resolve(),
  });
  await completed.promise;
}

describe('AuthenticatedApiErrorHandler', () => {
  beforeEach(() => {
    Cookies.set('sentry_react_auth', '1', {path: '/'});
    MockApiClient.addMockResponse({
      url: `/auth/organizations/${organizationSlug}/config/`,
      body: {
        authenticated: true,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {
          avatarUrl: null,
          name: 'Acme',
          slug: organizationSlug,
        },
        provider: {
          key: 'saml2',
          name: 'SAML',
        },
        warnings: [],
      },
    });
  });

  afterEach(() => {
    Cookies.remove('sentry_react_auth', {path: '/'});
    fetchMock.resetMocks();
  });

  it('keeps the SSO prompt dismissed until the pathname changes', async () => {
    const client = new Client();
    const {waitForModalToHide} = renderGlobalModal();
    const {router} = render(<AuthenticatedApiErrorHandler />, {
      initialRouterConfig: {
        location: {pathname: '/organizations/acme/issues/'},
        route: '*',
      },
    });

    await act(() => requestSsoRequired(client));
    expect(
      await screen.findByRole('heading', {name: 'Authenticate With SSO'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitForModalToHide();

    await act(() => requestSsoRequired(client));
    expect(
      screen.queryByRole('heading', {name: 'Authenticate With SSO'})
    ).not.toBeInTheDocument();

    router.navigate('/organizations/acme/releases/');
    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/acme/releases/')
    );

    await act(() => requestSsoRequired(client));
    expect(
      await screen.findByRole('heading', {name: 'Authenticate With SSO'})
    ).toBeInTheDocument();
  });
});
