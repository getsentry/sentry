import {useEffect} from 'react';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  AdminConfirmationModal,
  type AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

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

  it('obeys showTicketURL prop', async () => {
    render(
      <AdminConfirmationModal
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        showTicketURL={false}
      >
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.queryByRole('textbox', {name: 'TicketURL'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Notes'})).toBeInTheDocument();
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

  it('lets render content decide what to confirm with', async () => {
    function ActionContent({onConfirm, setConfirmCallback}: AdminConfirmRenderProps) {
      useEffect(() => {
        setConfirmCallback(params => onConfirm?.({...params, extra: 'value'}));
      }, [onConfirm, setConfirmCallback]);
      return <div>Action content</div>;
    }

    render(
      <AdminConfirmationModal
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        renderModalSpecificContent={deps => <ActionContent {...deps} />}
      >
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByText('Action content')).toBeInTheDocument();
    await setNotes('notes');
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(mockOnConfirm).toHaveBeenCalledWith({notes: 'notes', extra: 'value'});
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

  it('keeps confirm enabled on initial render', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();
  });

  it('shows the URL error on confirm and stays open', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await setTicketURL('1invalid');

    const confirmButton = screen.getByRole('button', {name: 'Confirm'});
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    expect(await screen.findByText('Invalid ticket URL')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('clears the URL error once the URL is fixed', async () => {
    render(
      <AdminConfirmationModal onConfirm={mockOnConfirm} onCancel={mockOnCancel}>
        <button>Open Modal</button>
      </AdminConfirmationModal>
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await setTicketURL('1invalid');
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    expect(await screen.findByText('Invalid ticket URL')).toBeInTheDocument();

    await setTicketURL('https://sentry.zendesk.com/agent/tickets/1234');
    await waitFor(() =>
      expect(screen.queryByText('Invalid ticket URL')).not.toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    await waitFor(() =>
      expect(mockOnConfirm).toHaveBeenCalledWith({
        ticketURL: 'https://sentry.zendesk.com/agent/tickets/1234',
      })
    );
  });
});
