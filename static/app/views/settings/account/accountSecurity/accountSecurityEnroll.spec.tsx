import {AuthenticatorsFixture} from 'sentry-fixture/authenticators';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import AccountSecurityEnroll from 'sentry/views/settings/account/accountSecurity/accountSecurityEnroll';

const ENDPOINT = '/users/me/authenticators/';
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
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: authenticator,
      });
    });

    it('does not have enrolled circle indicator', async () => {
      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.authId}/enroll/`,
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
            pathname: `/settings/account/security/mfa/${authenticator.authId}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Enrollment QR Code')).toBeInTheDocument();
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
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        method: 'POST',
      });
      const fetchOrgsMock = MockApiClient.addMockResponse({
        url: `/organizations/`,
        body: [usorg],
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.authId}/enroll/`,
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
        `${ENDPOINT}15/enroll/`,
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
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        method: 'POST',
      });
      const fetchOrgsMock = MockApiClient.addMockResponse({
        url: `/organizations/`,
        body: [usorg],
      });

      render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.authId}/enroll/`,
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
        `${ENDPOINT}15/enroll/`,
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
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: {details: 'Already enrolled'},
        statusCode: 400,
      });

      const {router} = render(<AccountSecurityEnroll />, {
        initialRouterConfig: {
          location: {
            pathname: `/settings/account/security/mfa/${authenticator.authId}/enroll/`,
          },
          route: '/settings/account/security/mfa/:authId/enroll/',
        },
      });

      await waitFor(() => {
        expect(router.location.pathname).toBe('/settings/account/security/');
      });
    });
  });
});
