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
  function renderComponent() {
    renderGlobalModal();
    act(() =>
      openModal(modalProps => <TokenRegenerationConfirmationModal {...modalProps} />)
    );
  }

  it('renders modal with correct header', function () {
    renderComponent();

    expect(screen.getByRole('heading', {name: 'Token created'})).toBeInTheDocument();
  });

  it('displays warning alert with token safety message', function () {
    renderComponent();

    expect(
      screen.getByText(
        `Please copy this token to a safe place - it won't be shown again.`
      )
    ).toBeInTheDocument();
  });

  it('displays both token inputs', function () {
    renderComponent();

    const tokenInputs = screen.getAllByRole('textbox');
    expect(tokenInputs).toHaveLength(2);

    // Check that the token values are displayed
    expect(screen.getByDisplayValue('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('91b57316-b1ff-4884-8d55-92b9936a05a3')
    ).toBeInTheDocument();
  });

  it('renders Done button', function () {
    renderComponent();

    expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
  });

  it('closes modal when Done button is clicked', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button', {name: 'Done'}));

    // Verify modal is closed by checking that the header is no longer present
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Token created'})
      ).not.toBeInTheDocument();
    });
  });

  it('has copy functionality for both tokens', function () {
    renderComponent();

    // Check that copy buttons are present (from TextCopyInput component)
    const copyButtons = screen.getAllByRole('button', {name: /copy/i});
    expect(copyButtons).toHaveLength(2);
  });
});
