import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AccountSecurity from 'app/views/settings/account/accountSecurity';
import AccountSecurityWrapper from 'app/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';
const AUTH_ENDPOINT = '/auth/';

describe('AccountSecurity', function () {
  beforeEach(function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});

    Client.clearMockResponses();
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations(),
    });
  });

  afterEach(function () {
    window.location.assign.mockRestore();
  });

  it('renders empty', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
  });

  it('renders a primary interface that is enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({configureButton: 'Info'})],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Authenticator App');

    // There should be an "Info" button
    expect(
      wrapper.find('Button[className="details-button"]').first().prop('children')
    ).toBe('Info');

    // Remove button
    expect(wrapper.find('button[aria-label="delete"]')).toHaveLength(1);
    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(true);

    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
  });

  it('can delete enrolled authenticator', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    const deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(true);

    // next authenticators request should have totp disabled
    const authenticatorsMock = Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          isEnrolled: false,
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    // This will open confirm modal
    wrapper.find('button[aria-label="delete"]').simulate('click');

    // Confirm
    wrapper.find('Modal Button').last().simulate('click');

    await tick();
    wrapper.update();

    expect(deleteMock).toHaveBeenCalled();

    // Should only have been called once
    expect(authenticatorsMock).toHaveBeenCalledTimes(1);

    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(false);

    // No enrolled authenticators
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('can remove one of multiple 2fa methods when org requires 2fa', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
        TestStubs.Authenticators().U2f(),
      ],
    });
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });
    const deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('AuthenticatorStatus').first().prop('enabled')).toBe(true);

    expect(wrapper.find('RemoveConfirm').first().prop('disabled')).toBe(false);
    expect(wrapper.find('Tooltip').first().prop('disabled')).toBe(true);

    // This will open confirm modal
    wrapper.find('button[aria-label="delete"]').first().simulate('click');

    // Confirm
    wrapper.find('Modal Button').last().simulate('click');
    expect(deleteMock).toHaveBeenCalled();
  });

  it('can not remove last 2fa method when org requires 2fa', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });
    const deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(true);

    expect(wrapper.find('RemoveConfirm').prop('disabled')).toBe(true);
    expect(wrapper.find('Tooltip').prop('disabled')).toBe(false);
    expect(wrapper.find('Tooltip').prop('title')).toContain('test 1 and test 2');

    // This will open confirm modal
    wrapper.find('button[aria-label="delete"]').simulate('click');
    // Confirm
    expect(wrapper.find('Modal Button')).toHaveLength(0);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('renders a primary interface that is not enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Authenticator App');
    // There should be an "Add" button
    expect(
      wrapper.find('Button[className="enroll-button"]').first().prop('children')
    ).toBe('Add');
    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(false);
    // user is not 2fa enrolled
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('renders a backup interface that is not enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Recovery Codes');

    // There should be an View Codes button
    expect(wrapper.find('Button[className="details-button"]')).toHaveLength(0);
    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(false);
    // user is not 2fa enrolled
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('renders a backup interface that is enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: true})],
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Recovery Codes');
    // There should be an View Codes button
    expect(
      wrapper.find('Button[className="details-button"]').first().prop('children')
    ).toBe('View Codes');
    expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(true);
  });

  it('can change password', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });

    const url = '/users/me/password/';
    const mock = Client.addMockResponse({
      url,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    wrapper
      .find('PasswordForm input[name="password"]')
      .simulate('change', {target: {value: 'oldpassword'}});
    wrapper
      .find('PasswordForm input[name="passwordNew"]')
      .simulate('change', {target: {value: 'newpassword'}});
    wrapper
      .find('PasswordForm input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'newpassword'}});
    wrapper.find('PasswordForm form').simulate('submit');

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          password: 'oldpassword',
          passwordNew: 'newpassword',
          passwordVerify: 'newpassword',
        },
      })
    );
    // user is not 2fa enrolled
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('requires current password to be entered', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });
    const url = '/users/me/password/';
    const mock = Client.addMockResponse({
      url,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    wrapper
      .find('PasswordForm input[name="passwordNew"]')
      .simulate('change', {target: {value: 'newpassword'}});
    wrapper
      .find('PasswordForm input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'newpassword'}});
    wrapper.find('PasswordForm form').simulate('submit');

    expect(mock).not.toHaveBeenCalled();
    // user is not 2fa enrolled
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('can expire all sessions', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });
    const mock = Client.addMockResponse({
      url: AUTH_ENDPOINT,
      body: {all: true},
      method: 'DELETE',
      status: 204,
    });

    const wrapper = mountWithTheme(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );

    wrapper.find('Button[data-test-id="signoutAll"]').simulate('click');

    await tick();
    expect(window.location.assign).toHaveBeenCalledWith('/auth/login/');
    expect(mock).toHaveBeenCalled();
  });
});
