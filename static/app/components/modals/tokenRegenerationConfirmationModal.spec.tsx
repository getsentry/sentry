import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {makeCloseButton} from 'sentry/components/globalModal/components';
import TokenRegenerationConfirmationModal from 'sentry/components/modals/tokenRegenerationConfirmationModal';

describe('TokenRegenerationConfirmationModal', function () {
  const closeModal = jest.fn();

  const styledWrapper = styled((c: PropsWithChildren) => c.children);
  const modalRenderProps: ModalRenderProps = {
    Body: styledWrapper(),
    Footer: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    closeModal,
    CloseButton: makeCloseButton(() => {}),
  };

  function renderComponent() {
    return render(<TokenRegenerationConfirmationModal {...modalRenderProps} />);
  }

  beforeEach(function () {
    closeModal.mockClear();
  });

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
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('has copy functionality for both tokens', function () {
    renderComponent();

    // Check that copy buttons are present (from TextCopyInput component)
    const copyButtons = screen.getAllByRole('button', {name: /copy/i});
    expect(copyButtons).toHaveLength(2);
  });
});
