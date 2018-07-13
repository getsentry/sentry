import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import AccountSecurity from 'app/views/settings/account/accountSecurity';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';

describe('AccountSecurity', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations(),
    });
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });

    let wrapper = shallow(<AccountSecurity />, TestStubs.routerContext());

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
  });

  it('renders a primary interface that is enrolled', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({configureButton: 'Info'})],
    });

    let wrapper = shallow(<AccountSecurity />, TestStubs.routerContext());

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Authenticator App');

    // There should be an "Info" button
    expect(
      wrapper
        .find('Button')
        .first()
        .prop('children')
    ).toBe('Info');

    // Remove button
    expect(wrapper.find('Button .icon-trash')).toHaveLength(1);
    expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(true);

    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
  });

  it('can delete enrolled authenticator', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    let deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    let wrapper = mount(<AccountSecurity />, TestStubs.routerContext());
    expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(true);

    // This will open confirm modal
    wrapper.find('Button .icon-trash').simulate('click');
    // Confirm
    wrapper
      .find('Modal Button')
      .last()
      .simulate('click');

    expect(deleteMock).toHaveBeenCalled();

    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(false);
    }, 1);
    // still has another 2fa method
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(0);
  });

  it('renders a primary interface that is not enrolled', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });

    let wrapper = shallow(<AccountSecurity />, TestStubs.routerContext());

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Authenticator App');
    // There should be an "Add" button
    expect(
      wrapper
        .find('Button')
        .first()
        .prop('children')
    ).toBe('Add');
    expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(false);
    // user is not 2fa enrolled
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('renders a backup interface that is not enrolled', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });

    let wrapper = shallow(<AccountSecurity />, TestStubs.routerContext());

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Recovery Codes');

    // There should be an View Codes button
    expect(wrapper.find('Button')).toHaveLength(0);
    expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(false);
    // user is not 2fa enrolled
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
  });

  it('renders a backup interface that is enrolled', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: true})],
    });

    let wrapper = shallow(<AccountSecurity />, TestStubs.routerContext());

    expect(wrapper.find('AuthenticatorName').prop('children')).toBe('Recovery Codes');

    // There should be an View Codes button
    expect(
      wrapper
        .find('Button')
        .first()
        .prop('children')
    ).toBe('View Codes');
    expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(true);
  });

  it('can change password', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });

    let url = '/users/me/password/';
    let mock = Client.addMockResponse({
      url,
      method: 'PUT',
    });

    let wrapper = mount(<AccountSecurity />, TestStubs.routerContext());

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

  it('requires current password to be entered', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });
    let url = '/users/me/password/';
    let mock = Client.addMockResponse({
      url,
      method: 'PUT',
    });

    let wrapper = mount(<AccountSecurity />, TestStubs.routerContext());

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
});
