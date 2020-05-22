import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AccountSecurityEnroll from 'app/views/settings/account/accountSecurity/accountSecurityEnroll';

const ENDPOINT = '/users/me/authenticators/';

describe('AccountSecurityEnroll', function() {
  let wrapper;

  describe('Totp', function() {
    Client.clearMockResponses();
    const authenticator = TestStubs.Authenticators().Totp({
      isEnrolled: false,
      qrcode: [[1, 0]],
      secret: 'secret',
      form: [
        {
          type: 'string',
          name: 'otp',
        },
      ],
    });

    beforeAll(function() {
      Client.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: authenticator,
      });
      wrapper = mountWithTheme(
        <AccountSecurityEnroll />,
        TestStubs.routerContext([
          {
            router: {
              ...TestStubs.router(),
              params: {
                authId: authenticator.authId,
              },
            },
          },
        ])
      );
    });

    it('does not have enrolled circle indicator', function() {
      expect(wrapper.find('CircleIndicator').prop('enabled')).toBe(false);
    });

    it('has qrcode component', function() {
      expect(wrapper.find('Qrcode')).toHaveLength(1);
    });

    it('can enroll', function() {
      const enrollMock = Client.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        method: 'POST',
      });

      wrapper.find('input[name="otp"]').simulate('change', {target: {value: 'otp'}});
      wrapper.find('Form').simulate('submit');
      expect(enrollMock).toHaveBeenCalledWith(
        `${ENDPOINT}15/enroll/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            secret: 'secret',
            otp: 'otp',
          }),
        })
      );
    });

    it('can redirect with already enrolled error', function() {
      Client.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: {details: 'Already enrolled'},
        statusCode: 400,
      });

      const pushMock = jest.fn();
      wrapper = mountWithTheme(
        <AccountSecurityEnroll />,
        TestStubs.routerContext([
          {
            router: {
              ...TestStubs.router({
                push: pushMock,
              }),
              params: {
                authId: authenticator.authId,
              },
            },
          },
        ])
      );
      expect(pushMock).toHaveBeenCalledWith('/settings/account/security/');
    });
  });
});
