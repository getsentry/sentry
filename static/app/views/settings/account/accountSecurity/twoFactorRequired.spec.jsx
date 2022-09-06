import Cookies from 'js-cookie';
import * as qs from 'query-string';

import {mountWithTheme} from 'sentry-test/enzyme';

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
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations(),
    });
    MockApiClient.addMockResponse({
      url: ACCOUNT_EMAILS_ENDPOINT,
      body: TestStubs.AccountEmails(),
    });
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is disabled and no pendingInvite cookie', function () {
    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is enrolled and no pendingInvite cookie', function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: true})],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
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
      body: [TestStubs.Authenticators().Totp({isEnrolled: true})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
    Cookies.remove(INVITE_COOKIE);
  });

  it('renders when 2FA is disabled and has pendingInvite cookie', function () {
    Cookies.set(INVITE_COOKIE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(1);
    Cookies.remove(INVITE_COOKIE);
  });
});
