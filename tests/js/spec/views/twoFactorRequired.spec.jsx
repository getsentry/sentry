import React from 'react';
import {mount} from 'enzyme';
import Cookies from 'js-cookie';

import TwoFactorRequired from 'app/views/settings/account/accountSecurity/';
import AccountSecurityWrapper from 'app/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';
const PENDING_INVITE = 'pending-invite';

describe('TwoFactorRequired', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations(),
    });
  });

  it('renders empty', function() {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    const wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is disabled and no pendingInvite cookie', function() {
    const wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is enrolled and no pendingInvite cookie', function() {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: true})],
    });

    const wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is enrolled and has pendingInvite cookie', function() {
    Cookies.set(PENDING_INVITE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: true})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });

    const wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(0);
    Cookies.remove(PENDING_INVITE);
  });

  it('renders when 2FA is disabled and has pendingInvite cookie', function() {
    Cookies.set(PENDING_INVITE, '/accept/5/abcde/');
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });

    const wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[data-test-id="require-2fa"]')).toHaveLength(1);
    Cookies.remove(PENDING_INVITE);
  });
});
