import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import AccountSecurityEnroll from 'sentry/views/settings/account/accountSecurity/accountSecurityEnroll';

const ENDPOINT = '/users/me/authenticators/';

describe('AccountSecurityEnroll', function () {
  describe('Totp', function () {
    Client.clearMockResponses();
    const authenticator = TestStubs.Authenticators().Totp({
      isEnrolled: false,
      qrcode: 'otpauth://totp/test%40sentry.io?issuer=Sentry&secret=secret',
      secret: 'secret',
      form: [
        {
          type: 'string',
          name: 'otp',
          label: 'OTP Code',
        },
      ],
    });

    const routerContext = TestStubs.routerContext([
      {
        router: {
          ...TestStubs.router(),
          params: {authId: authenticator.authId},
        },
      },
    ]);

    beforeAll(function () {
      Client.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: authenticator,
      });
    });

    it('does not have enrolled circle indicator', function () {
      render(<AccountSecurityEnroll />, {context: routerContext});

      expect(
        screen.getByRole('status', {name: 'Authentication Method Inactive'})
      ).toBeInTheDocument();
    });

    it('has qrcode component', function () {
      render(<AccountSecurityEnroll />, {context: routerContext});

      expect(screen.getByLabelText('Enrollment QR Code')).toBeInTheDocument();
    });

    it('can enroll', function () {
      const enrollMock = Client.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        method: 'POST',
      });

      render(<AccountSecurityEnroll />, {context: routerContext});

      userEvent.type(screen.getByRole('textbox', {name: 'OTP Code'}), 'otp{enter}');

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

    it('can redirect with already enrolled error', function () {
      Client.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: {details: 'Already enrolled'},
        statusCode: 400,
      });

      const pushMock = jest.fn();
      const routerContextWithMock = TestStubs.routerContext([
        {
          router: {
            ...TestStubs.router({push: pushMock}),
            params: {authId: authenticator.authId},
          },
        },
      ]);

      render(<AccountSecurityEnroll />, {context: routerContextWithMock});

      expect(pushMock).toHaveBeenCalledWith('/settings/account/security/');
    });
  });
});
