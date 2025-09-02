import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import DemoEndModal from 'sentry/components/modals/demoEndModal';

describe('DemoEndModal', () => {
  it('closes on close button click', async () => {
    const closeModal = jest.fn();

    renderGlobalModal();

    act(() =>
      openModal(modalProps => <DemoEndModal {...modalProps} tour="issues" />, {
        onClose: closeModal,
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeModal).toHaveBeenCalled();
  });

  it('opens sign up page on button click', () => {
    renderGlobalModal();

    act(() => openModal(modalProps => <DemoEndModal {...modalProps} tour="issues" />));

    const signUpButton = screen.getByRole('button', {name: 'Sign up for Sentry'});
    expect(signUpButton).toBeInTheDocument();
    expect(signUpButton).toHaveAttribute('href', 'https://sentry.io/signup/');
  });
});
