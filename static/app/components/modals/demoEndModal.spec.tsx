import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import DemoEndModal from 'sentry/components/modals/demoEndModal';

describe('DemoEndModal', function () {
  const organization = TestStubs.Organization();

  it('closes on close button click', function () {
    const closeModal = jest.fn();

    renderGlobalModal();

    openModal(
      modalProps => (
        <DemoEndModal {...modalProps} orgSlug={organization.slug} tour="issues" />
      ),
      {onClose: closeModal}
    );

    userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeModal).toHaveBeenCalled();
  });

  it('restarts tour on button click', function () {
    const finishMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });

    // Tests that fetchGuide is being called when tour is restarted
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/assistant/',
    });

    renderGlobalModal();

    openModal(modalProps => (
      <DemoEndModal {...modalProps} orgSlug={organization.slug} tour="issues" />
    ));

    userEvent.click(screen.getByRole('button', {name: 'Restart Tour'}));
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

    openModal(modalProps => (
      <DemoEndModal {...modalProps} orgSlug={organization.slug} tour="issues" />
    ));

    const signUpButton = screen.getByRole('button', {name: 'Sign up for Sentry'});
    expect(signUpButton).toBeInTheDocument();
    expect(signUpButton).toHaveAttribute('href', 'https://sentry.io/signup/');
  });
});
