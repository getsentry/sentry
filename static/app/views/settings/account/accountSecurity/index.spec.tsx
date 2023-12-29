import {AccountEmails} from 'sentry-fixture/accountEmails';
import {Authenticators} from 'sentry-fixture/authenticators';
import {Organizations} from 'sentry-fixture/organizations';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';
import AccountSecurity from 'sentry/views/settings/account/accountSecurity';
import AccountSecurityWrapper from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';
const ACCOUNT_EMAILS_ENDPOINT = '/users/me/emails/';
const AUTH_ENDPOINT = '/auth/';

describe('AccountSecurity', function () {
  const router = RouterFixture();
  beforeEach(function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations(),
    });
    MockApiClient.addMockResponse({
      url: ACCOUNT_EMAILS_ENDPOINT,
      body: AccountEmails(),
    });
  });

  afterEach(function () {
    (window.location.assign as jest.Mock).mockRestore();
  });

  function renderComponent() {
    return render(
      <AccountSecurityWrapper
        location={router.location}
        route={router.routes[0]}
        routes={router.routes}
        router={router}
        routeParams={router.params}
        params={{...router.params, authId: '15'}}
      >
        <AccountSecurity
          deleteDisabled={false}
          authenticators={[]}
          hasVerifiedEmail
          countEnrolled={0}
          handleRefresh={jest.fn()}
          onDisable={jest.fn()}
          orgsRequire2fa={[]}
          location={router.location}
          route={router.routes[0]}
          routes={router.routes}
          router={router}
          routeParams={router.params}
          params={{...router.params, authId: '15'}}
        />
      </AccountSecurityWrapper>,
      {context: RouterContextFixture()}
    );
  }

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [],
    });

    renderComponent();

    expect(
      await screen.findByText('No available authenticators to add')
    ).toBeInTheDocument();
  });

  it('renders a primary interface that is enrolled', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Totp({configureButton: 'Info'})],
    });

    renderComponent();

    expect(await screen.findByText('Authenticator App')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Info'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Active'})
    ).toBeInTheDocument();
  });

  it('can delete enrolled authenticator', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    renderComponent();

    expect(deleteMock).not.toHaveBeenCalled();

    expect(
      await screen.findByRole('status', {name: 'Authentication Method Active'})
    ).toBeInTheDocument();

    // next authenticators request should have totp disabled
    const authenticatorsMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        Authenticators().Totp({
          isEnrolled: false,
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    // Should only have been called once
    await waitFor(() => expect(authenticatorsMock).toHaveBeenCalledTimes(1));
    expect(deleteMock).toHaveBeenCalled();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();
  });

  it('can remove one of multiple 2fa methods when org requires 2fa', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
        Authenticators().U2f(),
      ],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations({require2FA: true}),
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    renderComponent();

    expect(
      await screen.findAllByRole('status', {name: 'Authentication Method Active'})
    ).toHaveLength(2);

    await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]);

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('can not remove last 2fa method when org requires 2fa', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: Organizations({require2FA: true}),
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    renderComponent();

    expect(deleteMock).not.toHaveBeenCalled();

    expect(
      await screen.findByRole('status', {name: 'Authentication Method Active'})
    ).toBeInTheDocument();

    await userEvent.hover(screen.getByRole('button', {name: 'Delete'}));
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();

    expect(
      await screen.findByText(
        'Two-factor authentication is required for organization(s): test 1 and test 2.'
      )
    ).toBeInTheDocument();
  });

  it('cannot enroll without verified email', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Totp({isEnrolled: false})],
    });
    MockApiClient.addMockResponse({
      url: ACCOUNT_EMAILS_ENDPOINT,
      body: [
        {
          email: 'primary@example.com',
          isPrimary: true,
          isVerified: false,
        },
      ],
    });

    renderComponent();

    const openEmailModalFunc = jest.spyOn(ModalStore, 'openModal');

    expect(
      await screen.findByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add'}));

    await waitFor(() => expect(openEmailModalFunc).toHaveBeenCalled());
  });

  it('renders a backup interface that is not enrolled', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Recovery({isEnrolled: false})],
    });

    renderComponent();

    expect(
      await screen.findByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();

    expect(screen.getByText('Recovery Codes')).toBeInTheDocument();
  });

  it('renders a primary interface that is not enrolled', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Totp({isEnrolled: false})],
    });

    renderComponent();

    expect(
      await screen.findByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();

    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
  });

  it('does not render primary interface that disallows new enrollments', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        Authenticators().Totp({disallowNewEnrollment: false}),
        Authenticators().U2f({disallowNewEnrollment: undefined}),
        Authenticators().Sms({disallowNewEnrollment: true}),
      ],
    });

    renderComponent();

    expect(await screen.findByText('Authenticator App')).toBeInTheDocument();
    expect(screen.getByText('U2F (Universal 2nd Factor)')).toBeInTheDocument();
    expect(screen.queryByText('Text Message')).not.toBeInTheDocument();
  });

  it('renders primary interface if new enrollments are disallowed, but we are enrolled', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Sms({isEnrolled: true, disallowNewEnrollment: true})],
    });

    renderComponent();

    // Should still render the authenticator since we are already enrolled
    expect(await screen.findByText('Text Message')).toBeInTheDocument();
  });

  it('renders a backup interface that is enrolled', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Recovery({isEnrolled: true})],
    });

    renderComponent();

    expect(await screen.findByText('Recovery Codes')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Codes'})).toBeEnabled();
  });

  it('can change password', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Recovery({isEnrolled: false})],
    });

    const url = '/users/me/password/';
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    renderComponent();

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Current Password'}),
      'oldpassword'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'New Password'}),
      'newpassword'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Verify New Password'}),
      'newpassword'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Change password'}));

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
  });

  it('requires current password to be entered', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Recovery({isEnrolled: false})],
    });
    const url = '/users/me/password/';
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    renderComponent();

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'New Password'}),
      'newpassword'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Verify New Password'}),
      'newpassword'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Change password'}));

    expect(mock).not.toHaveBeenCalled();
  });

  it('can expire all sessions', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [Authenticators().Recovery({isEnrolled: false})],
    });
    const mock = MockApiClient.addMockResponse({
      url: AUTH_ENDPOINT,
      body: {all: true},
      method: 'DELETE',
      status: 204,
    });

    renderComponent();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Sign out of all devices'})
    );

    expect(mock).toHaveBeenCalled();
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith('/auth/login/')
    );
  });
});
