import Cookies from 'js-cookie';
import * as qs from 'query-string';
import {AccountEmailsFixture} from 'sentry-fixture/accountEmails';
import {AuthenticatorsFixture} from 'sentry-fixture/authenticators';
import {OrganizationsFixture} from 'sentry-fixture/organizations';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AccountSecurity from 'sentry/views/settings/account/accountSecurity/';
import AccountSecurityWrapper from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';
const INVITE_COOKIE = 'pending-invite';
const ACCOUNT_EMAILS_ENDPOINT = '/users/me/emails/';

describe('TwoFactorRequired', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [AuthenticatorsFixture().Totp({isEnrolled: false})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: OrganizationsFixture(),
    });
    MockApiClient.addMockResponse({
      url: ACCOUNT_EMAILS_ENDPOINT,
      body: AccountEmailsFixture(),
    });
  });

  it('renders empty', async () => {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    render(<AccountSecurityWrapper />, {
      initialRouterConfig: {
        location: {
          pathname: '/settings/account/security/',
        },
        route: '/settings/account/security/',
        children: [
          {
            index: true,
            element: <AccountSecurity />,
          },
        ],
      },
    });

    expect(await screen.findByText('Current Password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is disabled and no pendingInvite cookie', async () => {
    render(<AccountSecurityWrapper />, {
      initialRouterConfig: {
        location: {
          pathname: '/settings/account/security/',
        },
        route: '/settings/account/security/',
        children: [
          {
            index: true,
            element: <AccountSecurity />,
          },
        ],
      },
    });

    expect(await screen.findByText('Current Password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is enrolled and no pendingInvite cookie', async () => {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [AuthenticatorsFixture().Totp({isEnrolled: true})],
    });

    render(<AccountSecurityWrapper />, {
      initialRouterConfig: {
        location: {
          pathname: '/settings/account/security/',
        },
        route: '/settings/account/security/',
        children: [
          {
            index: true,
            element: <AccountSecurity />,
          },
        ],
      },
    });

    expect(await screen.findByText('Current Password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is enrolled and has pendingInvite cookie', async () => {
    const cookieData = {
      memberId: 5,
      token: 'abcde',
      url: '/accept/5/abcde/',
    };
    Cookies.set(INVITE_COOKIE, qs.stringify(cookieData));
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [AuthenticatorsFixture().Totp({isEnrolled: true})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: OrganizationsFixture({require2FA: true}),
    });

    render(<AccountSecurityWrapper />, {
      initialRouterConfig: {
        location: {
          pathname: '/settings/account/security/',
        },
        route: '/settings/account/security/',
        children: [
          {
            index: true,
            element: <AccountSecurity />,
          },
        ],
      },
    });

    expect(await screen.findByText('Current Password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });

  it('renders when 2FA is disabled and has pendingInvite cookie', async () => {
    Cookies.set(INVITE_COOKIE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: OrganizationsFixture({require2FA: true}),
    });

    render(<AccountSecurityWrapper />, {
      initialRouterConfig: {
        location: {
          pathname: '/settings/account/security/',
        },
        route: '/settings/account/security/',
        children: [
          {
            index: true,
            element: <AccountSecurity />,
          },
        ],
      },
    });

    expect(await screen.findByTestId('require-2fa')).toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });
});
