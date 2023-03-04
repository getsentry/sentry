import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import RecoveryOptionsModal from 'sentry/components/modals/recoveryOptionsModal';

describe('RecoveryOptionsModal', function () {
  const closeModal = jest.fn();
  const onClose = jest.fn();
  const mockId = TestStubs.Authenticators().Recovery().authId;
  const routerContext = TestStubs.routerContext();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: TestStubs.AllAuthenticators(),
    });
  });

  function renderComponent() {
    render(
      <RecoveryOptionsModal
        Body={p => p.children}
        Header={p => p.children}
        Footer={p => p.children}
        authenticatorName="Authenticator App"
        closeModal={closeModal}
        onClose={onClose}
      />,
      {context: routerContext}
    );
  }

  it('can redirect to recovery codes if user skips backup phone setup', async function () {
    renderComponent();

    expect(
      screen.queryByRole('button', {name: 'Get Recovery Codes'})
    ).not.toBeInTheDocument();

    // skip backup phone setup
    await userEvent.click(screen.getByRole('button', {name: 'Skip this step'}));

    const getCodesbutton = screen.getByRole('button', {name: 'Get Recovery Codes'});
    expect(getCodesbutton).toBeInTheDocument();

    expect(getCodesbutton).toHaveAttribute(
      'href',
      `/settings/account/security/mfa/${mockId}/`
    );

    await userEvent.click(getCodesbutton);
    expect(closeModal).toHaveBeenCalled();
  });

  it('can redirect to backup phone setup', async function () {
    renderComponent();

    const backupPhoneButton = screen.getByRole('button', {name: 'Add a Phone Number'});
    expect(backupPhoneButton).toBeInTheDocument();
    expect(backupPhoneButton).toHaveAttribute(
      'href',
      '/settings/account/security/mfa/sms/enroll/'
    );

    await userEvent.click(backupPhoneButton);
    expect(closeModal).toHaveBeenCalled();
  });

  it('skips backup phone setup if text message authenticator unavailable', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: [TestStubs.Authenticators().Totp(), TestStubs.Authenticators().Recovery()],
    });

    renderComponent();

    const getCodesbutton = screen.getByRole('button', {name: 'Get Recovery Codes'});
    expect(getCodesbutton).toBeInTheDocument();

    expect(getCodesbutton).toHaveAttribute(
      'href',
      `/settings/account/security/mfa/${mockId}/`
    );

    expect(
      screen.queryByRole('button', {name: 'Skip this step'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Add a Phone Number'})
    ).not.toBeInTheDocument();
  });
});
