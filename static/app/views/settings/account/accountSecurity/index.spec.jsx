import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import ModalStore from 'sentry/stores/modalStore';
import AccountSecurity from 'sentry/views/settings/account/accountSecurity';
import AccountSecurityWrapper from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';
const ACCOUNT_EMAILS_ENDPOINT = '/users/me/emails/';
const AUTH_ENDPOINT = '/auth/';

describe('AccountSecurity', function () {
  beforeEach(function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});

    Client.clearMockResponses();
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations(),
    });
    Client.addMockResponse({
      url: ACCOUNT_EMAILS_ENDPOINT,
      body: TestStubs.AccountEmails(),
    });
  });

  afterEach(function () {
    window.location.assign.mockRestore();
  });

  function renderComponent() {
    return render(
      <AccountSecurityWrapper>
        <AccountSecurity />
      </AccountSecurityWrapper>,
      {context: TestStubs.routerContext()}
    );
  }

  it('renders empty', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });

    renderComponent();

    expect(screen.getByText('No available authenticators to add')).toBeInTheDocument();
  });

  it('renders a primary interface that is enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({configureButton: 'Info'})],
    });

    renderComponent();

    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Info'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Active'})
    ).toBeInTheDocument();
  });

  it('can delete enrolled authenticator', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    const deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    renderComponent();

    expect(deleteMock).not.toHaveBeenCalled();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Active'})
    ).toBeInTheDocument();

    // next authenticators request should have totp disabled
    const authenticatorsMock = Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          isEnrolled: false,
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });

    userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    // Should only have been called once
    await waitFor(() => expect(authenticatorsMock).toHaveBeenCalledTimes(1));
    expect(deleteMock).toHaveBeenCalled();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();
  });

  it('can remove one of multiple 2fa methods when org requires 2fa', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
        TestStubs.Authenticators().U2f(),
      ],
    });
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });
    const deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    renderComponent();

    expect(
      screen.getAllByRole('status', {name: 'Authentication Method Active'})
    ).toHaveLength(2);

    userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]);

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('can not remove last 2fa method when org requires 2fa', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({
          authId: '15',
          configureButton: 'Info',
        }),
      ],
    });
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });
    const deleteMock = Client.addMockResponse({
      url: `${ENDPOINT}15/`,
      method: 'DELETE',
    });

    renderComponent();

    expect(deleteMock).not.toHaveBeenCalled();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Active'})
    ).toBeInTheDocument();

    userEvent.hover(screen.getByRole('button', {name: 'Delete'}));
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();

    expect(
      await screen.findByText(
        'Two-factor authentication is required for organization(s): test 1 and test 2.'
      )
    ).toBeInTheDocument();
  });

  it('cannot enroll without verified email', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });
    Client.addMockResponse({
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
      screen.getByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Add'}));

    await waitFor(() => expect(openEmailModalFunc).toHaveBeenCalled());
  });

  it('renders a backup interface that is not enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });

    renderComponent();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();

    expect(screen.getByText('Recovery Codes')).toBeInTheDocument();
  });

  it('renders a primary interface that is not enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });

    renderComponent();

    expect(
      screen.getByRole('status', {name: 'Authentication Method Inactive'})
    ).toBeInTheDocument();

    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
  });

  it('does not render primary interface that disallows new enrollments', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Totp({disallowNewEnrollment: false}),
        TestStubs.Authenticators().U2f({disallowNewEnrollment: null}),
        TestStubs.Authenticators().Sms({disallowNewEnrollment: true}),
      ],
    });

    renderComponent();

    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
    expect(screen.getByText('U2F (Universal 2nd Factor)')).toBeInTheDocument();
    expect(screen.queryByText('Text Message')).not.toBeInTheDocument();
  });

  it('renders primary interface if new enrollments are disallowed, but we are enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        TestStubs.Authenticators().Sms({isEnrolled: true, disallowNewEnrollment: true}),
      ],
    });

    renderComponent();

    // Should still render the authenticator since we are already enrolled
    expect(screen.getByText('Text Message')).toBeInTheDocument();
  });

  it('renders a backup interface that is enrolled', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: true})],
    });

    renderComponent();

    expect(screen.getByText('Recovery Codes')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Codes'})).toBeEnabled();
  });

  it('can change password', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });

    const url = '/users/me/password/';
    const mock = Client.addMockResponse({
      url,
      method: 'PUT',
    });

    renderComponent();

    userEvent.type(
      screen.getByRole('textbox', {name: 'Current Password'}),
      'oldpassword'
    );
    userEvent.type(screen.getByRole('textbox', {name: 'New Password'}), 'newpassword');
    userEvent.type(
      screen.getByRole('textbox', {name: 'Verify New Password'}),
      'newpassword'
    );

    userEvent.click(screen.getByRole('button', {name: 'Change password'}));

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

  it('requires current password to be entered', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });
    const url = '/users/me/password/';
    const mock = Client.addMockResponse({
      url,
      method: 'PUT',
    });

    renderComponent();

    userEvent.type(screen.getByRole('textbox', {name: 'New Password'}), 'newpassword');
    userEvent.type(
      screen.getByRole('textbox', {name: 'Verify New Password'}),
      'newpassword'
    );

    userEvent.click(screen.getByRole('button', {name: 'Change password'}));

    expect(mock).not.toHaveBeenCalled();
  });

  it('can expire all sessions', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Recovery({isEnrolled: false})],
    });
    const mock = Client.addMockResponse({
      url: AUTH_ENDPOINT,
      body: {all: true},
      method: 'DELETE',
      status: 204,
    });

    renderComponent();

    userEvent.click(screen.getByRole('button', {name: 'Sign out of all devices'}));

    expect(mock).toHaveBeenCalled();
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith('/auth/login/')
    );
  });
});
