import {AccountEmails} from 'fixtures/js-stubs/accountEmails';
import {Authenticators} from 'fixtures/js-stubs/authenticators';
import {Organizations} from 'fixtures/js-stubs/organizations';
import {routerContext} from 'fixtures/js-stubs/routerContext';
import Cookies from 'js-cookie';
import * as qs from 'query-string';

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
      body: [Authenticators().Totp({isEnrolled: false})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations(),
    });
    MockApiClient.addMockResponse({
      url: ACCOUNT_EMAILS_ENDPOINT,
      body: AccountEmails(),
    });
  });

  const routerContext = routerContext();

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is disabled and no pendingInvite cookie', function () {
    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is enrolled and no pendingInvite cookie', function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Totp({isEnrolled: true})],
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is enrolled and has pendingInvite cookie', function () {
    const cookieData = {
      memberId: 5,
      token: 'abcde',
      url: '/accept/5/abcde/',
    };
    Cookies.set(INVITE_COOKIE, qs.stringify(cookieData));
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Totp({isEnrolled: true})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations({require2FA: true}),
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });

  it('renders when 2FA is disabled and has pendingInvite cookie', function () {
    Cookies.set(INVITE_COOKIE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations({require2FA: true}),
    });

    render(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.getByTestId('require-2fa')).toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });
});
