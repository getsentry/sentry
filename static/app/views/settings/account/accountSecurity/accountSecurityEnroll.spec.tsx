import {AuthenticatorsFixture} from 'sentry-fixture/authenticators';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {handleEnroll} from 'sentry/components/webAuthn/handlers';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import AccountSecurityEnroll from 'sentry/views/settings/account/accountSecurity/accountSecurityEnroll';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/components/webAuthn/handlers');

const ENDPOINT = '/users/me/authenticators/';
const mockAddErrorMessage = jest.mocked(addErrorMessage);
const mockHandleEnroll = jest.mocked(handleEnroll);
const usorg = OrganizationFixture({
  slug: 'us-org',
  links: {
    organizationUrl: 'https://us-org.example.test',
    regionUrl: 'https://us.example.test',
  },
});

describe('AccountSecurityEnroll', () => {
  describe('Totp', () => {
    const authenticator = AuthenticatorsFixture().Totp({
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

    beforeEach(() => {
      setWindowLocation('https://example.test');
      window.__initialData = {
        ...window.__initialData,
        links: {
          organizationUrl: undefined,
          regionUrl: undefined,
          sentryUrl: 'https://example.test',
        },
      };
      OrganizationsStore.load([usorg]);

      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        body: authenticator,
      });
    });

    it('does not have enrolled circle indicator', async () => {
      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('status', {name: 'Authentication Method Inactive'})
        ).toBeInTheDocument();
      });
    });

    it('has qrcode component', async () => {
      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Enrollment QR Code')).toBeInTheDocument();
      });
    });

    it('does not submit an empty authenticator token', async () => {
      const enrollMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      expect(enrollMock).not.toHaveBeenCalled();
      expect(screen.getByText('Authenticator token is required')).toBeInTheDocument();
    });

    it('shows the API error details when enrollment fails', async () => {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
        statusCode: 400,
        body: [{details: 'Invalid OTP'}],
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.type(
        await screen.findByRole('textbox', {name: 'OTP Code'}),
        'invalid{enter}'
      );

      await waitFor(() => {
        expect(mockAddErrorMessage).toHaveBeenCalledWith('Invalid OTP');
      });
    });

    it('shows a fallback when enrollment fails without API details', async () => {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
        statusCode: 400,
        body: {},
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.type(
        await screen.findByRole('textbox', {name: 'OTP Code'}),
        'invalid{enter}'
      );

      await waitFor(() => {
        expect(mockAddErrorMessage).toHaveBeenCalledWith(
          'Could not add the Authenticator App authenticator. Try again.'
        );
      });
    });

    it('can enroll from org subdomain', async () => {
      setWindowLocation('https://us-org.example.test');
      window.__initialData = {
        ...window.__initialData,
        links: {
          organizationUrl: 'https://us-org.example.test',
          regionUrl: 'https://us.example.test',
          sentryUrl: 'https://example.test',
        },
      };

      const enrollMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });
      const fetchOrgsMock = MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [usorg],
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('status', {name: 'Authentication Method Inactive'})
        ).toBeInTheDocument();
      });

      await userEvent.type(screen.getByRole('textbox', {name: 'OTP Code'}), 'otp{enter}');

      expect(enrollMock).toHaveBeenCalledWith(
        `${ENDPOINT}${authenticator.id}/enroll/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            secret: 'secret',
            otp: 'otp',
          }),
        })
      );
      expect(fetchOrgsMock).not.toHaveBeenCalled();
      expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    });

    it('can enroll from main domain', async () => {
      OrganizationsStore.load([]);
      window.__initialData = {
        ...window.__initialData,
        links: {
          organizationUrl: 'https://us-org.example.test',
          regionUrl: 'https://us.example.test',
          sentryUrl: 'https://example.test',
        },
      };

      const enrollMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });
      const fetchOrgsMock = MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [usorg],
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('status', {name: 'Authentication Method Inactive'})
        ).toBeInTheDocument();
      });

      await userEvent.type(screen.getByRole('textbox', {name: 'OTP Code'}), 'otp{enter}');

      expect(enrollMock).toHaveBeenCalledWith(
        `${ENDPOINT}${authenticator.id}/enroll/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            secret: 'secret',
            otp: 'otp',
          }),
        })
      );
      expect(fetchOrgsMock).toHaveBeenCalledTimes(1);
      expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://us-org.example.test/'
      );
    });

    it('can redirect with already enrolled error', async () => {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        body: {details: 'Already enrolled'},
        statusCode: 400,
      });

      const {router} = render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(router.location.pathname).toBe('/settings/account/security/');
      });
    });
  });

  describe('SMS', () => {
    const authenticator = AuthenticatorsFixture().Sms({
      authId: '16',
      isEnrolled: false,
      secret: 'sms-secret',
      form: [
        {
          type: 'string',
          name: 'phone',
          label: 'Phone number',
        },
        {
          type: 'string',
          name: 'otp',
          label: 'Authenticator code',
        },
      ],
    });

    beforeEach(() => {
      setWindowLocation('https://us-org.example.test');
      OrganizationsStore.load([usorg]);
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        body: authenticator,
      });
    });

    it('sends a code and can reset the enrollment flow', async () => {
      const enrollMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      const phoneInput = await screen.findByRole('textbox', {name: 'Phone number'});
      await userEvent.type(phoneInput, '+15555550123');
      await userEvent.click(screen.getByRole('button', {name: 'Send Code'}));

      await waitFor(() => {
        expect(enrollMock).toHaveBeenCalledWith(
          `${ENDPOINT}${authenticator.id}/enroll/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              phone: '+15555550123',
              secret: 'sms-secret',
            },
          })
        );
      });
      expect(await screen.findByRole('button', {name: 'Confirm'})).toBeInTheDocument();
      expect(phoneInput).toBeDisabled();

      await userEvent.click(screen.getByRole('button', {name: 'Start Over'}));

      expect(await screen.findByRole('button', {name: 'Send Code'})).toBeInTheDocument();
      expect(phoneInput).toBeEnabled();
      expect(
        screen.queryByRole('textbox', {name: 'Authenticator code'})
      ).not.toBeInTheDocument();
    });

    it('returns to the phone step when sending the code fails', async () => {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
        statusCode: 400,
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      const phoneInput = await screen.findByRole('textbox', {name: 'Phone number'});
      await userEvent.type(phoneInput, '+15555550123');
      await userEvent.click(screen.getByRole('button', {name: 'Send Code'}));

      expect(await screen.findByRole('button', {name: 'Send Code'})).toBeInTheDocument();
      expect(phoneInput).toBeEnabled();
      expect(
        screen.queryByRole('textbox', {name: 'Authenticator code'})
      ).not.toBeInTheDocument();
    });

    it('keeps the same enrollment session when OTP verification fails', async () => {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.type(
        await screen.findByRole('textbox', {name: 'Phone number'}),
        '+15555550123'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Send Code'}));
      await screen.findByRole('button', {name: 'Confirm'});

      MockApiClient.clearMockResponses();
      const refetchMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        body: {...authenticator, secret: 'different-secret'},
      });
      const verifyMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
        statusCode: 400,
      });

      await userEvent.type(
        screen.getByRole('textbox', {name: 'Authenticator code'}),
        '123456'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => expect(verifyMock).toHaveBeenCalled());
      expect(verifyMock).toHaveBeenCalledWith(
        `${ENDPOINT}${authenticator.id}/enroll/`,
        expect.objectContaining({
          data: expect.objectContaining({secret: 'sms-secret'}),
        })
      );
      expect(refetchMock).not.toHaveBeenCalled();
      expect(
        screen.getByRole('textbox', {name: 'Authenticator code'})
      ).toBeInTheDocument();
    });
  });

  describe('WebAuthn', () => {
    const authenticator = AuthenticatorsFixture().U2f({
      isEnrolled: false,
      form: [
        {
          type: 'string',
          name: 'deviceName',
          label: 'Device name',
          defaultValue: 'My passkey',
        },
      ],
    });

    beforeEach(() => {
      setWindowLocation('https://us-org.example.test');
      OrganizationsStore.load([usorg]);
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        body: authenticator,
      });
      Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: function PublicKeyCredential() {},
      });
      mockHandleEnroll.mockResolvedValue('webauthn-response');
    });

    afterEach(() => {
      Reflect.deleteProperty(window, 'PublicKeyCredential');
    });

    it('requires browser enrollment before submitting the device', async () => {
      const enrollMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      expect(await screen.findByText('(required)')).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      expect(enrollMock).not.toHaveBeenCalled();
      expect(
        screen.getByText('Enroll your device before continuing.')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Start Enrollment'}));
      expect(await screen.findByRole('button', {name: 'Enrolled!'})).toBeDisabled();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(enrollMock).toHaveBeenCalledWith(
          `${ENDPOINT}${authenticator.id}/enroll/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              challenge: JSON.stringify(authenticator.challenge),
              deviceName: 'My passkey',
              response: 'webauthn-response',
            },
          })
        );
      });
    });

    it('shows an error message when browser enrollment fails', async () => {
      mockHandleEnroll.mockResolvedValue(null);

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Start Enrollment'})
      );

      await waitFor(() => {
        expect(mockAddErrorMessage).toHaveBeenCalledWith(
          'There was a problem enrolling, please try again.'
        );
      });
    });

    it('validates the device name length with Zod', async () => {
      const enrollMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Start Enrollment'})
      );
      const deviceName = screen.getByRole('textbox', {name: 'Device name'});
      await userEvent.clear(deviceName);
      await userEvent.type(deviceName, 'a'.repeat(61));
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(enrollMock).not.toHaveBeenCalled();
      expect(
        screen.getByText('Device name must be 60 characters or fewer.')
      ).toBeInTheDocument();
    });

    it('shows backend errors on the corresponding fields', async () => {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.id}/enroll/`,
        method: 'POST',
        statusCode: 400,
        body: {
          deviceName: ['Ensure this field has no more than 60 characters.'],
          challenge: ['Not a valid string.'],
          response: ['This field is required.'],
        },
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Start Enrollment'})
      );
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(
        await screen.findByText('Ensure this field has no more than 60 characters.')
      ).toBeInTheDocument();
      expect(screen.getByText(/Not a valid string\./)).toBeInTheDocument();
      expect(screen.queryByText('This field is required.')).not.toBeInTheDocument();
      expect(mockAddErrorMessage).not.toHaveBeenCalled();

      expect(screen.getByRole('button', {name: 'Start Enrollment'})).toBeEnabled();
      mockHandleEnroll.mockResolvedValue('new-webauthn-response');
      await userEvent.click(screen.getByRole('button', {name: 'Start Enrollment'}));

      expect(mockHandleEnroll).toHaveBeenCalledTimes(2);
      expect(await screen.findByRole('button', {name: 'Enrolled!'})).toBeDisabled();
    });
  });
});
