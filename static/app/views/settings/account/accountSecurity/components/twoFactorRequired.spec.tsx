import Cookies from 'js-cookie';
import * as qs from 'query-string';
import {AccountEmails} from 'sentry-fixture/accountEmails';
import {Authenticators} from 'sentry-fixture/authenticators';
import {Organizations} from 'sentry-fixture/organizations';

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

  const {routerContext, routerProps} = initializeOrg();

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

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    render(
      <AccountSecurityWrapper {...routerProps} params={{authId: ''}}>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
  });

  it('does not render when 2FA is disabled and no pendingInvite cookie', function () {
    render(
      <AccountSecurityWrapper {...routerProps} params={{authId: ''}}>
        <TwoFactorRequired {...baseProps} />
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
      <AccountSecurityWrapper {...routerProps} params={{authId: ''}}>
        <TwoFactorRequired {...baseProps} />
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
      <AccountSecurityWrapper {...routerProps} params={{authId: ''}}>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(screen.queryByTestId('require-2fa')).not.toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });

  it('renders when 2FA is disabled and has pendingInvite cookie', async function () {
    Cookies.set(INVITE_COOKIE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations({require2FA: true}),
    });

    render(
      <AccountSecurityWrapper {...routerProps} params={{authId: ''}}>
        <TwoFactorRequired {...baseProps} />
      </AccountSecurityWrapper>,
      {context: routerContext}
    );

    expect(await screen.findByTestId('require-2fa')).toBeInTheDocument();
    Cookies.remove(INVITE_COOKIE);
  });
});
