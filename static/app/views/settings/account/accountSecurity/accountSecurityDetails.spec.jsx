import {AccountEmails} from 'fixtures/js-stubs/accountEmails';
import {AllAuthenticators} from 'fixtures/js-stubs/allAuthenticators';
import {Authenticators} from 'fixtures/js-stubs/authenticators';
import {Organizations} from 'fixtures/js-stubs/organizations';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';

import {Client} from 'sentry/api';
import AccountSecurityDetails from 'sentry/views/settings/account/accountSecurity/accountSecurityDetails';
import AccountSecurityWrapper from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ACCOUNT_EMAILS_ENDPOINT = '/users/me/emails/';
const ORG_ENDPOINT = '/organizations/';

describe('AccountSecurityDetails', function () {
  let wrapper;
  let routerContext;
  let router;
  let params;

  describe('Totp', function () {
    beforeAll(function () {
      Client.clearMockResponses();
      params = {
        authId: 15,
      };

      ({router, routerContext} = initializeOrg({
        router: {
          params,
        },
      }));

      Client.addMockResponse({
        url: ENDPOINT,
        body: AllAuthenticators(),
      });
      Client.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations(),
      });
      Client.addMockResponse({
        url: `${ENDPOINT}15/`,
        body: Authenticators().Totp(),
      });
      Client.addMockResponse({
        url: ACCOUNT_EMAILS_ENDPOINT,
        body: AccountEmails(),
      });
      wrapper = mountWithTheme(
        <AccountSecurityWrapper router={router} params={params}>
          <AccountSecurityDetails router={router} params={params} />
        </AccountSecurityWrapper>,
        routerContext
      );
    });

    it('has enrolled circle indicator', function () {
      expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(true);
    });

    it('has created and last used dates', function () {
      expect(wrapper.find('AuthenticatorDate')).toHaveLength(2);
    });

    it('can remove method', async function () {
      const deleteMock = Client.addMockResponse({
        url: `${ENDPOINT}15/`,
        method: 'DELETE',
      });

      wrapper.find('RemoveConfirm Button').simulate('click');

      const modal = await mountGlobalModal();
      modal.find('Button[priority="primary"]').simulate('click');

      expect(deleteMock).toHaveBeenCalled();
    });

    it('can remove one of multiple 2fa methods when org requires 2fa', async function () {
      Client.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations({require2FA: true}),
      });
      const deleteMock = Client.addMockResponse({
        url: `${ENDPOINT}15/`,
        method: 'DELETE',
      });

      wrapper = mountWithTheme(
        <AccountSecurityWrapper router={router} params={params}>
          <AccountSecurityDetails router={router} params={params} />
        </AccountSecurityWrapper>,
        routerContext
      );

      wrapper.find('RemoveConfirm Button').simulate('click');
      const modal = await mountGlobalModal();
      modal.find('Button[priority="primary"]').simulate('click');

      expect(deleteMock).toHaveBeenCalled();
    });

    it('can not remove last 2fa method when org requires 2fa', async function () {
      Client.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations({require2FA: true}),
      });
      Client.addMockResponse({
        url: ENDPOINT,
        body: [Authenticators().Totp()],
      });
      const deleteMock = Client.addMockResponse({
        url: `${ENDPOINT}15/`,
        method: 'DELETE',
      });

      wrapper = mountWithTheme(
        <AccountSecurityWrapper router={router} params={params}>
          <AccountSecurityDetails router={router} params={params} />
        </AccountSecurityWrapper>,
        routerContext
      );

      wrapper.find('RemoveConfirm Button').simulate('click');
      const modal = await mountGlobalModal();
      expect(modal.find('Modal[show=true]').exists()).toBe(false);

      expect(deleteMock).not.toHaveBeenCalled();
    });
  });

  describe('Recovery', function () {
    beforeEach(function () {
      params = {authId: 16};
      ({router, routerContext} = initializeOrg({
        router: {
          params,
        },
      }));

      Client.clearMockResponses();
      Client.addMockResponse({
        url: ENDPOINT,
        body: AllAuthenticators(),
      });
      Client.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations(),
      });
      Client.addMockResponse({
        url: `${ENDPOINT}16/`,
        body: Authenticators().Recovery(),
      });
      Client.addMockResponse({
        url: ACCOUNT_EMAILS_ENDPOINT,
        body: AccountEmails(),
      });

      wrapper = mountWithTheme(
        <AccountSecurityWrapper router={router} params={params}>
          <AccountSecurityDetails router={router} params={params} />
        </AccountSecurityWrapper>,
        routerContext
      );
    });

    it('has enrolled circle indicator', function () {
      expect(wrapper.find('AuthenticatorStatus').prop('enabled')).toBe(true);
    });

    it('has created and last used dates', function () {
      expect(wrapper.find('AuthenticatorDate')).toHaveLength(2);
    });

    it('does not have remove button', function () {
      expect(wrapper.find('RemoveConfirm')).toHaveLength(0);
    });

    it('regenerates codes', function () {
      const deleteMock = Client.addMockResponse({
        url: `${ENDPOINT}16/`,
        method: 'PUT',
      });

      wrapper.find('RecoveryCodes').prop('onRegenerateBackupCodes')();

      expect(deleteMock).toHaveBeenCalled();
    });

    it('has copy, print and download buttons', function () {
      const codes = 'ABCD-1234 \nEFGH-5678';

      const downloadCodes = `Button[href="data:text/plain;charset=utf-8,${codes}"]`;
      expect(wrapper.find(downloadCodes)).toHaveLength(1);
      wrapper.find(downloadCodes).simulate('click');

      expect(wrapper.find('button[aria-label="print"]')).toHaveLength(1);
      expect(wrapper.find('iframe[name="printable"]')).toHaveLength(1);
      expect(wrapper.find(`Clipboard[value="${codes}"]`)).toHaveLength(1);
    });
  });
});
