import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import NavigateToExternalLinkModal from 'sentry/components/modals/navigateToExternalLinkModal';

describe('NavigateToExternalLinkModal', () => {
  it('closes on cancel button click', async () => {
    const closeModal = jest.fn();
    const linkText = 'http://test-url.com';

    renderGlobalModal();

    act(() =>
      openModal(
        modalProps => <NavigateToExternalLinkModal {...modalProps} linkText={linkText} />,
        {onClose: closeModal}
      )
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeModal).toHaveBeenCalled();
  });

  it('should render with a valid URL', () => {
    const linkText = 'http://test-url.com';
    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <NavigateToExternalLinkModal {...modalProps} linkText={linkText} />
      ))
    );

    const signUpButton = screen.getByRole('button', {name: 'Continue'});
    const link = screen.getByText(linkText);
    expect(signUpButton).toBeInTheDocument();
    expect(link).toBeInTheDocument();
  });

  // eslint-disable-next-line no-script-url
  it.each(['javascript:alert(document.domain)', 'data:text/html,<script>1</script>'])(
    'does not offer to navigate to %s',
    linkText => {
      renderGlobalModal();

      act(() =>
        openModal(modalProps => (
          <NavigateToExternalLinkModal {...modalProps} linkText={linkText} />
        ))
      );

      expect(screen.getByText(linkText)).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    }
  );

  it('navigates on continue button click', async () => {
    const closeModal = jest.fn();
    const linkText = 'http://test-url.com';

    renderGlobalModal();
    window.open = jest.fn().mockImplementation(() => true);

    act(() =>
      openModal(
        modalProps => <NavigateToExternalLinkModal {...modalProps} linkText={linkText} />,
        {onClose: closeModal}
      )
    );

    const button = screen.getByRole('button', {name: 'Continue'});

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', linkText);

    await userEvent.click(button);
    expect(closeModal).toHaveBeenCalled();
  });
});
