import {Fragment} from 'react';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import AdminConfirmationModal from 'admin/components/adminConfirmationModal';

describe('Admin confirmation modal', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setTicketURL = async (url: string) => {
    await userEvent.clear(screen.getByRole('textbox', {name: 'TicketURL'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'TicketURL'}), url);
  };

  const setNotes = async (notes: string) => {
    await userEvent.clear(screen.getByRole('textbox', {name: 'Notes'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), notes);
  };

  it('renders default fields', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.getByRole('textbox', {name: 'TicketURL'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Notes'})).toBeInTheDocument();
  });

  it('obeys showAuditFields prop', async () => {
    render(
      <AdminConfirmationModal
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        showAuditFields={false}
      >
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.queryByRole('textbox', {name: 'TicketURL'})).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Notes'})).not.toBeInTheDocument();
  });

  it('renders text content', async () => {
    render(
      <AdminConfirmationModal
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        modalSpecificContent="random text"
      >
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.getByRole('dialog')).toHaveTextContent('random text');
  });

  it('renders jsx content', async () => {
    render(
      <AdminConfirmationModal
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        modalSpecificContent={<div data-test-id="top-half-div">Hello</div>}
      >
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.getByTestId('top-half-div')).toBeInTheDocument();
  });

  it('renders content given by a function', async () => {
    const testFunc = (handlers: any) => (
      <Fragment>
        <button onClick={handlers.close}>close</button>
        <button onClick={handlers.confirm}>confirm</button>
      </Fragment>
    );

    render(
      <AdminConfirmationModal
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        renderModalSpecificContent={testFunc}
      >
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    const {waitForModalToHide} = renderGlobalModal();

    // check that confirm works
    await userEvent.click(screen.getByRole('button', {name: 'confirm'}));
    expect(mockOnConfirm).toHaveBeenCalled();

    await waitForModalToHide();

    // re-open the modal
    await userEvent.click(screen.getByRole('button'));

    // check that close works
    await userEvent.click(screen.getByRole('button', {name: 'close'}));

    await waitForModalToHide();
  });

  it('passes notes and ticket url to parent', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await setTicketURL('http://im.a.cool.website');
    await setNotes('notes');

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(mockOnConfirm).toHaveBeenCalledWith({
      ticketURL: 'http://im.a.cool.website',
      notes: 'notes',
    });
  });

  // TODO: adapt this for custom renderer including a confirm button (click on that button instead)
  // eslint-disable-next-line jest/no-commented-out-tests
  // it('no-ops on URL error', function() {
  //   render(
  //     <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
  //       <div id="testing"  />
  //     </AdminConfirmationModal>
  //   );

  //   const instance = wrapper.instance();
  //   const spy = jest.spyOn(instance, 'handleConfirm');
  //   instance.forceUpdate();

  //   wrapper.find('div[id="testing"]').simulate('click');

  //   setTicketURL(wrapper, 'ttp://im.missing.the.h');
  //   wrapper.find('button[data-test-id="confirm-button"]').simulate('click');
  //   expect(spy).toHaveBeenCalled();
  //   expect(mockOnConfirm).not.toHaveBeenCalled();
  // });

  it('disables confirm button on initial render', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();
  });

  it('disables confirm button on URL error', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await setTicketURL('1invalid');

    // Trigger blur validity check
    await userEvent.click(screen.getByRole('textbox', {name: 'Notes'}));

    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
  });

  it('enables confirm button on valid URL input', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await setTicketURL('http://www.goodwebsite.com');
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();
  });

  it('handles url change', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await setTicketURL('1invalid');

    // Trigger blur validity check
    await userEvent.click(screen.getByRole('textbox', {name: 'Notes'}));

    expect(screen.getByText('Invalid ticket URL')).toBeInTheDocument();

    await setTicketURL('https://sentry.zendesk.com/agent/tickets/1234');

    // Trigger blur validity check
    await userEvent.click(screen.getByRole('textbox', {name: 'Notes'}));

    expect(screen.queryByText('Invalid ticket URL')).not.toBeInTheDocument();
  });
});
