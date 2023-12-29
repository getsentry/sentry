import styled from '@emotion/styled';
import {AllAuthenticators, Authenticators} from 'sentry-fixture/authenticators';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import RecoveryOptionsModal from 'sentry/components/modals/recoveryOptionsModal';

describe('RecoveryOptionsModal', function () {
  const closeModal = jest.fn();
  const mockId = Authenticators().Recovery().authId;
  const routerContext = RouterContextFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: AllAuthenticators(),
    });
  });

  function renderComponent() {
    const styledWrapper = styled(c => c.children);

    render(
      <RecoveryOptionsModal
        Body={styledWrapper()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        authenticatorName="Authenticator App"
        closeModal={closeModal}
        CloseButton={makeCloseButton(() => {})}
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

  it('skips backup phone setup if text message authenticator unavailable', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: [Authenticators().Totp(), Authenticators().Recovery()],
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
