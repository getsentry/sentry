import {Organization} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import DemoEndModal from 'sentry/components/modals/demoEndModal';

describe('DemoEndModal', function () {
  const organization = Organization();

  it('closes on close button click', async function () {
    const closeModal = jest.fn();

    renderGlobalModal();

    act(() =>
      openModal(
        modalProps => (
          <DemoEndModal {...modalProps} orgSlug={organization.slug} tour="issues" />
        ),
        {onClose: closeModal}
      )
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeModal).toHaveBeenCalled();
  });

  it('restarts tour on button click', async function () {
    const finishMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });

    // Tests that fetchGuide is being called when tour is restarted
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/assistant/',
    });

    const {waitForModalToHide} = renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <DemoEndModal {...modalProps} orgSlug={organization.slug} tour="issues" />
      ))
    );

    await userEvent.click(screen.getByRole('button', {name: 'Restart Tour'}));
    await waitForModalToHide();

    expect(finishMock).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          guide: 'issues_v3',
          status: 'restart',
        },
      })
    );
  });

  it('opens sign up page on button click', function () {
    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <DemoEndModal {...modalProps} orgSlug={organization.slug} tour="issues" />
      ))
    );

    const signUpButton = screen.getByRole('button', {name: 'Sign up for Sentry'});
    expect(signUpButton).toBeInTheDocument();
    expect(signUpButton).toHaveAttribute('href', 'https://sentry.io/signup/');
  });
});
