import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import TokenRegenerationConfirmationModal from 'sentry/components/modals/tokenRegenerationConfirmationModal';

describe('TokenRegenerationConfirmationModal', function () {
  function renderComponent(token: string) {
    renderGlobalModal();
    act(() =>
      openModal(modalProps => (
        <TokenRegenerationConfirmationModal token={token} {...modalProps} />
      ))
    );
  }

  it('renders modal with correct header', function () {
    renderComponent('test-token-12345');

    expect(screen.getByRole('heading', {name: 'Token created'})).toBeInTheDocument();
  });

  it('displays warning alert with token safety message', function () {
    renderComponent('test-token-12345');

    expect(
      screen.getByText(
        `Please copy this token to a safe place - it won't be shown again.`
      )
    ).toBeInTheDocument();
  });

  it('displays both token inputs with correct values', function () {
    const testToken = 'test-token-12345';
    renderComponent(testToken);

    const tokenInputs = screen.getAllByRole('textbox');
    expect(tokenInputs).toHaveLength(2);

    expect(screen.getByDisplayValue('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
    expect(screen.getByLabelText('Prevent Variable')).toBeInTheDocument();

    expect(screen.getByDisplayValue(testToken)).toBeInTheDocument();
    expect(screen.getByLabelText('Token')).toBeInTheDocument();
  });

  it('renders Done button', function () {
    renderComponent('test-token-12345');

    expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
  });

  it('closes modal when Done button is clicked', async function () {
    renderComponent('test-token-12345');

    await userEvent.click(screen.getByRole('button', {name: 'Done'}));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Token created'})
      ).not.toBeInTheDocument();
    });
  });

  it('renders copy buttons for both tokens', function () {
    const testToken = 'test-token-12345';
    renderComponent(testToken);

    const copyButtons = screen.getAllByRole('button', {name: 'Copy'});
    expect(copyButtons).toHaveLength(2);
  });
});
