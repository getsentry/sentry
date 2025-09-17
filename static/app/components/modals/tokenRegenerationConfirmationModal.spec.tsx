import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import TokenRegenerationConfirmationModal from 'sentry/components/modals/tokenRegenerationConfirmationModal';

describe('TokenRegenerationConfirmationModal', () => {
  function renderComponent(token: string) {
    renderGlobalModal();
    act(() =>
      openModal(modalProps => (
        <TokenRegenerationConfirmationModal token={token} {...modalProps} />
      ))
    );
  }

  it('renders modal with correct header', () => {
    renderComponent('test-token-12345');

    expect(screen.getByRole('heading', {name: 'Token created'})).toBeInTheDocument();
  });

  it('displays both token inputs with correct values', () => {
    const testToken = 'test-token-12345';
    renderComponent(testToken);

    const tokenInputs = screen.getAllByRole('textbox');
    expect(tokenInputs).toHaveLength(2);

    expect(screen.getByDisplayValue('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
    expect(screen.getByLabelText('Prevent Variable')).toBeInTheDocument();

    expect(screen.getByDisplayValue(testToken)).toBeInTheDocument();
    expect(screen.getByLabelText('Token')).toBeInTheDocument();
  });

  it('renders copy buttons for both tokens', () => {
    const testToken = 'test-token-12345';
    renderComponent(testToken);

    const copyButtons = screen.getAllByRole('button', {name: 'Copy'});
    expect(copyButtons).toHaveLength(2);
  });
});
