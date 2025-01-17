import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {
  AllAuthenticatorsFixture,
  AuthenticatorsFixture,
} from 'sentry-fixture/authenticators';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import RecoveryOptionsModal from 'sentry/components/modals/recoveryOptionsModal';

describe('RecoveryOptionsModal', function () {
  const closeModal = jest.fn();
  const mockId = AuthenticatorsFixture().Recovery().authId;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: AllAuthenticatorsFixture(),
    });
  });

  function renderComponent() {
    const styledWrapper = styled((c: PropsWithChildren) => c.children);

    render(
      <RecoveryOptionsModal
        Body={styledWrapper()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        authenticatorName="Authenticator App"
        closeModal={closeModal}
        CloseButton={makeCloseButton(() => {})}
      />
    );
  }

  it('can redirect to recovery codes if user skips backup phone setup', async function () {
    renderComponent();
    const skipButton = await screen.findByRole('button', {name: 'Skip this step'});

    expect(
      screen.queryByRole('button', {name: 'Get Recovery Codes'})
    ).not.toBeInTheDocument();

    // skip backup phone setup
    await userEvent.click(skipButton);

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

    const backupPhoneButton = await screen.findByRole('button', {
      name: 'Add a Phone Number',
    });

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
      body: [AuthenticatorsFixture().Totp(), AuthenticatorsFixture().Recovery()],
    });

    renderComponent();

    const getCodesbutton = await screen.findByRole('button', {
      name: 'Get Recovery Codes',
    });
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

  it('renders the error message on API error', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      statusCode: 500,
    });

    renderComponent();

    const error = await screen.findByText('There was an error loading authenticators.');
    expect(error).toBeInTheDocument();
  });
});
