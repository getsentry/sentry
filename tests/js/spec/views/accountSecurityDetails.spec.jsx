import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import AccountSecurityDetails from 'app/views/settings/account/accountSecurity/accountSecurityDetails';

const ENDPOINT = '/users/me/authenticators/';

describe('AccountSecurityDetails', function() {
  let wrapper;

  describe('Totp', function() {
    Client.clearMockResponses();
    beforeAll(function() {
      Client.addMockResponse({
        url: `${ENDPOINT}15/`,
        body: TestStubs.Authenticators().Totp(),
      });
      wrapper = mount(
        <AccountSecurityDetails />,
        TestStubs.routerContext([
          {
            router: {
              ...TestStubs.router(),
              params: {
                authId: 15,
              },
            },
          },
        ])
      );
    });

    it('has enrolled circle indicator', function() {
      expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(true);
    });

    it('has created and last used dates', function() {
      expect(wrapper.find('AuthenticatorDate')).toHaveLength(2);
    });

    it('can remove method', function() {
      let deleteMock = Client.addMockResponse({
        url: `${ENDPOINT}15/`,
        method: 'DELETE',
      });

      wrapper.find('RemoveConfirm Button').simulate('click');
      wrapper
        .find('Modal Button')
        .last()
        .simulate('click');

      expect(deleteMock).toHaveBeenCalled();
    });
  });

  describe('Recovery', function() {
    beforeEach(function() {
      Client.clearMockResponses();
      Client.addMockResponse({
        url: `${ENDPOINT}16/`,
        body: TestStubs.Authenticators().Recovery(),
      });
      wrapper = mount(
        <AccountSecurityDetails />,
        TestStubs.routerContext([
          {
            router: {
              ...TestStubs.router(),
              params: {
                authId: 16,
              },
            },
          },
        ])
      );
    });

    it('has enrolled circle indicator', function() {
      expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(true);
    });

    it('has created and last used dates', function() {
      expect(wrapper.find('AuthenticatorDate')).toHaveLength(2);
    });

    it('does not have remove button', function() {
      expect(wrapper.find('RemoveConfirm')).toHaveLength(0);
    });

    it('regenerates codes', function() {
      let deleteMock = Client.addMockResponse({
        url: `${ENDPOINT}16/`,
        method: 'PUT',
      });

      wrapper.find('RecoveryCodes').prop('onRegenerateBackupCodes')();

      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
