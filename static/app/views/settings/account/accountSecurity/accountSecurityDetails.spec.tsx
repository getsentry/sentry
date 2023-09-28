import {AccountEmails} from 'sentry-fixture/accountEmails';
import {AllAuthenticators, Authenticators} from 'sentry-fixture/authenticators';
import {Organizations} from 'sentry-fixture/organizations';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import AccountSecurityDetails from 'sentry/views/settings/account/accountSecurity/accountSecurityDetails';
import AccountSecurityWrapper from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ACCOUNT_EMAILS_ENDPOINT = '/users/me/emails/';
const ORG_ENDPOINT = '/organizations/';

describe('AccountSecurityDetails', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });
  describe('Totp', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: ENDPOINT,
        body: AllAuthenticators(),
      });

      MockApiClient.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations(),
      });

      MockApiClient.addMockResponse({
        url: `${ENDPOINT}15/`,
        body: Authenticators().Totp(),
      });

      MockApiClient.addMockResponse({
        url: ACCOUNT_EMAILS_ENDPOINT,
        body: AccountEmails(),
      });
    });

    it('has enrolled circle indicator', async function () {
      const params = {
        authId: '15',
      };
      const {routerProps, routerContext} = initializeOrg({
        router: {
          params,
        },
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      expect(await screen.findByTestId('auth-status-enabled')).toBeInTheDocument();

      // has created and last used dates
      expect(screen.getByText('Created at')).toBeInTheDocument();
      expect(screen.getByText('Last used')).toBeInTheDocument();
    });

    it('can remove method', async function () {
      const deleteMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}15/`,
        method: 'DELETE',
      });

      const params = {
        authId: '15',
      };
      const {routerProps, routerContext} = initializeOrg({
        router: {
          params,
        },
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Remove'}));

      renderGlobalModal();

      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      expect(deleteMock).toHaveBeenCalled();
    });

    it('can remove one of multiple 2fa methods when org requires 2fa', async function () {
      MockApiClient.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations({require2FA: true}),
      });

      const deleteMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}15/`,
        method: 'DELETE',
      });

      const params = {
        authId: '15',
      };
      const {routerProps, routerContext} = initializeOrg({
        router: {
          params,
        },
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Remove'}));

      renderGlobalModal();

      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      expect(deleteMock).toHaveBeenCalled();
    });

    it('can not remove last 2fa method when org requires 2fa', async function () {
      MockApiClient.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations({require2FA: true}),
      });

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        body: [Authenticators().Totp()],
      });

      const params = {
        authId: '15',
      };

      const {routerContext, routerProps} = initializeOrg({
        router: {
          params,
        },
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      expect(await screen.findByRole('button', {name: 'Remove'})).toBeDisabled();
    });
  });

  describe('Recovery', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: ENDPOINT,
        body: AllAuthenticators(),
      });

      MockApiClient.addMockResponse({
        url: ORG_ENDPOINT,
        body: Organizations(),
      });

      MockApiClient.addMockResponse({
        url: `${ENDPOINT}16/`,
        body: Authenticators().Recovery(),
      });

      MockApiClient.addMockResponse({
        url: ACCOUNT_EMAILS_ENDPOINT,
        body: AccountEmails(),
      });
    });

    it('has enrolled circle indicator', function () {
      const params = {
        authId: '16',
      };

      const {routerProps, routerContext} = initializeOrg({
        router: {
          params,
        },
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      // does not have remove button
      expect(screen.queryByRole('button', {name: 'Remove'})).not.toBeInTheDocument();
    });

    it('regenerates codes', async function () {
      const deleteMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}16/`,
        method: 'PUT',
      });

      const params = {
        authId: '16',
      };

      const {routerProps, routerContext} = initializeOrg({
        router: {
          params,
        },
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Regenerate Codes'})
      );

      renderGlobalModal();

      expect(
        await screen.findByText(
          'Are you sure you want to regenerate recovery codes? Your old codes will no longer work.'
        )
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteMock).toHaveBeenCalled();
    });

    it('has copy, print and download buttons', async function () {
      const params = {
        authId: '16',
      };

      const {routerProps, routerContext} = initializeOrg({
        router: {
          params,
        },
      });

      Object.defineProperty(document, 'queryCommandSupported', {
        value: () => true,
      });

      render(
        <AccountSecurityWrapper {...routerProps}>
          <AccountSecurityDetails
            {...routerProps}
            onRegenerateBackupCodes={jest.fn()}
            deleteDisabled={false}
          />
        </AccountSecurityWrapper>,
        {context: routerContext}
      );

      expect(await screen.findByRole('button', {name: 'print'})).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'download'})).toHaveAttribute(
        'href',
        'data:text/plain;charset=utf-8,ABCD-1234 \nEFGH-5678'
      );

      expect(screen.getByTestId('frame')).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    });
  });
});
