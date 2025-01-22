import {AuthenticatorsFixture} from 'sentry-fixture/authenticators';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import AccountSecurityEnroll from 'sentry/views/settings/account/accountSecurity/accountSecurityEnroll';

const ENDPOINT = '/users/me/authenticators/';
const usorg = OrganizationFixture({
  slug: 'us-org',
  links: {
    organizationUrl: 'https://us-org.example.test',
    regionUrl: 'https://us.example.test',
  },
});

describe('AccountSecurityEnroll', function () {
  jest.spyOn(window.location, 'assign').mockImplementation(() => {});

  describe('Totp', function () {
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

    const router = RouterFixture({
      params: {authId: authenticator.authId},
    });

    let location: any;
    beforeEach(function () {
      location = window.location;
      window.location = location;
      window.location.href = 'https://example.test';
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

    it('does not have enrolled circle indicator', function () {
      render(<AccountSecurityEnroll />, {router});

      expect(
        screen.getByRole('status', {name: 'Authentication Method Inactive'})
      ).toBeInTheDocument();
    });

    it('has qrcode component', function () {
      render(<AccountSecurityEnroll />, {router});

      expect(screen.getByLabelText('Enrollment QR Code')).toBeInTheDocument();
    });

    it('can enroll from org subdomain', async function () {
      window.location.href = 'https://us-org.example.test';
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

      render(<AccountSecurityEnroll />, {router});

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
      expect(window.location.assign).not.toHaveBeenCalled();
    });

    it('can enroll from main domain', async function () {
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

      render(<AccountSecurityEnroll />, {router});

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
      expect(window.location.assign).toHaveBeenCalledTimes(1);
      expect(window.location.assign).toHaveBeenCalledWith('http://us-org.example.test/');
    });

    it('can redirect with already enrolled error', function () {
      MockApiClient.addMockResponse({
        url: `${ENDPOINT}${authenticator.authId}/enroll/`,
        body: {details: 'Already enrolled'},
        statusCode: 400,
      });

      const pushMock = jest.fn();
      const routerWithMock = RouterFixture({
        push: pushMock,
        params: {authId: authenticator.authId},
      });

      render(<AccountSecurityEnroll />, {router: routerWithMock});

      expect(pushMock).toHaveBeenCalledWith('/settings/account/security/');
    });
  });
});
