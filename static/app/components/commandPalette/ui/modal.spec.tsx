jest.unmock('lodash/debounce');

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({count}: {count: number}) => {
    const virtualItems = Array.from({length: count}, (_, index) => ({
      key: index,
      index,
      start: index * 48,
      size: 48,
      lane: 0,
    }));
    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * 48,
      measureElement: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import {
  CMDKAction,
  CommandPaletteProvider,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import CommandPaletteModal from 'sentry/components/commandPalette/ui/modal';
import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';

/**
 * Returns a minimal but valid ModalRenderProps with a jest.fn() as closeModal.
 * Header and CloseButton are wired to the same spy so all close paths are tracked.
 */
function makeRenderProps(closeModal: jest.Mock) {
  return {
    closeModal,
    Body: ModalBody,
    Footer: ModalFooter,
    Header: makeClosableHeader(closeModal),
    CloseButton: makeCloseButton(closeModal),
  };
}

/**
 * Renders the slot outlets that live outside CommandPalette in the real app
 * (they are mounted in navigation/index.tsx). Tests that use
 * <CommandPaletteSlot name="…"> must include this component so slot consumers
 * have a registered outlet element to portal into.
 */
function SlotOutlets() {
  return (
    <div style={{display: 'none'}}>
      <CommandPaletteSlot.Outlet name="task">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="page">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="global">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
    </div>
  );
}

describe('CommandPaletteModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls the render prop closeModal (not the imported one) when a leaf action is selected', async () => {
    // This test guards against the regression where modal.tsx called the
    // imported closeModal() directly. That bypasses GlobalModal's internal
    // closeModal(), so options.onClose never fires and state.open stays true —
    // causing the hotkey to need two presses to reopen the palette.
    const closeModalSpy = jest.fn();
    const onActionSpy = jest.fn();

    render(
      <CommandPaletteProvider>
        <CommandPaletteSlot name="task">
          <CMDKAction display={{label: 'Leaf Action'}} onAction={onActionSpy} />
        </CommandPaletteSlot>
        <SlotOutlets />
        <CommandPaletteModal {...makeRenderProps(closeModalSpy)} />
      </CommandPaletteProvider>
    );

    await userEvent.click(await screen.findByRole('option', {name: 'Leaf Action'}));

    // The action callback must fire …
    expect(onActionSpy).toHaveBeenCalledTimes(1);
    // … and the render-prop closeModal (which triggers options.onClose and
    // resets state.open) must be the one that is called, not an internally
    // imported closeModal that skips the onClose hook.
    expect(closeModalSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when a prompt action is selected', async () => {
    const closeModalSpy = jest.fn();

    render(
      <CommandPaletteProvider>
        <CMDKAction display={{label: 'DSN Tools'}}>
          <CMDKAction
            display={{label: 'Reverse DSN lookup'}}
            prompt="Paste a DSN..."
            resource={() =>
              cmdkQueryOptions({
                queryKey: ['prompt-modal-test'],
                queryFn: () => null,
                enabled: false,
              })
            }
          />
        </CMDKAction>
        <CommandPaletteModal {...makeRenderProps(closeModalSpy)} />
      </CommandPaletteProvider>
    );

    await userEvent.click(
      await screen.findByRole('option', {name: 'Reverse DSN lookup'})
    );

    expect(closeModalSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveAttribute(
      'placeholder',
      'Paste a DSN...'
    );
  });

  it('invokes an expandable action callback once and keeps the modal open', async () => {
    // Actions with children push into secondary actions — the modal stays open.
    const closeModalSpy = jest.fn();
    const onActionSpy = jest.fn();

    render(
      <CommandPaletteProvider>
        <CommandPaletteSlot name="task">
          <CMDKAction display={{label: 'Outer Group'}}>
            <CMDKAction display={{label: 'Parent Action'}} onAction={onActionSpy}>
              <CMDKAction display={{label: 'Child Action'}} onAction={jest.fn()} />
            </CMDKAction>
          </CMDKAction>
        </CommandPaletteSlot>
        <SlotOutlets />
        <CommandPaletteModal {...makeRenderProps(closeModalSpy)} />
      </CommandPaletteProvider>
    );

    await userEvent.click(await screen.findByRole('option', {name: 'Parent Action'}));

    expect(onActionSpy).toHaveBeenCalledTimes(1);
    // Modal must remain open so the user can select a secondary action
    expect(closeModalSpy).not.toHaveBeenCalled();
    // Secondary action is now visible
    expect(await screen.findByRole('option', {name: 'Child Action'})).toBeInTheDocument();
  });

  it('opens external links in a new tab', async () => {
    const closeModalSpy = jest.fn();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <CommandPaletteProvider>
        <CommandPaletteSlot name="task">
          <CMDKAction to="https://docs.sentry.io" display={{label: 'External Link'}} />
        </CommandPaletteSlot>
        <SlotOutlets />
        <CommandPaletteModal {...makeRenderProps(closeModalSpy)} />
      </CommandPaletteProvider>
    );

    await userEvent.click(await screen.findByRole('option', {name: 'External Link'}));

    expect(openSpy).toHaveBeenCalledWith(
      'https://docs.sentry.io',
      '_blank',
      'noreferrer'
    );
    expect(closeModalSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('opens internal links in a new tab when shift-enter is used', async () => {
    const closeModalSpy = jest.fn();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <CommandPaletteProvider>
        <CommandPaletteSlot name="task">
          <CMDKAction to="/target/" display={{label: 'Internal Link'}} />
        </CommandPaletteSlot>
        <SlotOutlets />
        <CommandPaletteModal {...makeRenderProps(closeModalSpy)} />
      </CommandPaletteProvider>
    );

    await screen.findByRole('textbox', {name: 'Search commands'});
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

    expect(openSpy).toHaveBeenCalledWith('/target/', '_blank', 'noreferrer');
    expect(closeModalSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });
});
