import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
// import {ThemeProvider} from 'emotion-theming';
// import theme from 'app/utils/theme';
import AccountSecurity from 'app/views/settings/account/accountSecurity';

const ENDPOINT = '/users/me/authenticators/';

describe('AccountSecurity', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });

    let wrapper = shallow(<AccountSecurity />, TestStubs.routerContext());

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
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

    wrapper.find('Button .icon-trash').simulate('click');
    expect(deleteMock).toHaveBeenCalled();

    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(false);
    }, 1);
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
});
