import Cookies from 'js-cookie';
import * as qs from 'query-string';
import {AccountEmailsFixture} from 'sentry-fixture/accountEmails';
import {AuthenticatorsFixture} from 'sentry-fixture/authenticators';
import {OrganizationsFixture} from 'sentry-fixture/organizations';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import TwoFactorRequired from 'sentry/views/settings/account/accountSecurity/';
import AccountSecurityWrapper from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';
const INVITE_COOKIE = 'pending-invite';
const ACCOUNT_EMAILS_ENDPOINT = '/users/me/emails/';

describe('TwoFactorRequired', function () {
  beforeEach(function () {
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

  const {router, routerProps} = initializeOrg();

  const baseProps = {
    authenticators: null,
    countEnrolled: 0,
    deleteDisabled: false,
    handleRefresh: () => {},
    hasVerifiedEmail: false,
    onDisable: () => {},
    orgsRequire2fa: [],
    ...routerProps,
  };

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {router}
    );

    expect(await screen.findByText('Your current password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is disabled and no pendingInvite cookie', async function () {
    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {router}
    );

    expect(await screen.findByText('Your current password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is enrolled and no pendingInvite cookie', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [AuthenticatorsFixture().Totp({isEnrolled: true})],
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {router}
    );

    expect(await screen.findByText('Your current password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is enrolled and has pendingInvite cookie', async function () {
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

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {router}
    );

    expect(await screen.findByText('Your current password')).toBeInTheDocument();
    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });

  it('renders when 2FA is disabled and has pendingInvite cookie', async function () {
    Cookies.set(INVITE_COOKIE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: OrganizationsFixture({require2FA: true}),
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {router}
    );

    expect(await screen.findByTestId('require-2fa')).toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });
});
