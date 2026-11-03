import * as Sentry from '@sentry/react';

import {
  act,
  render,
  renderGlobalModal,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InfoText} from '@sentry/scraps/info';
import {GlobalModal, useModal} from '@sentry/scraps/modal';

import {closeModal, openModal} from 'sentry/actionCreators/modal';
import {ErrorBoundary} from 'sentry/components/errorBoundary';

function ThrowingModal({error}: {error: Error}): React.ReactNode {
  throw error;
}

describe('GlobalModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('error recovery', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it.each(['component', 'renderer'] as const)(
      'contains errors from the modal %s and preserves the page',
      async source => {
        const error = new Error('Modal render failed');
        const onClose = jest.fn();

        render(
          <ErrorBoundary>
            <input aria-label="Page draft" />
            <GlobalModal />
          </ErrorBoundary>
        );

        const draft = screen.getByRole('textbox', {name: 'Page draft'});
        await userEvent.type(draft, 'Unsaved changes');

        act(() =>
          openModal(
            () => {
              if (source === 'renderer') {
                throw error;
              }
              return <ThrowingModal error={error} />;
            },
            {closeEvents: 'none', onClose}
          )
        );

        const dialog = screen.getByRole('dialog');
        expect(
          within(dialog).getByRole('heading', {name: 'Something went wrong'})
        ).toBeInTheDocument();
        expect(within(dialog).getByRole('alert')).toHaveTextContent(
          'There was a problem rendering the dialog.'
        );
        expect(draft).toBeInTheDocument();
        expect(draft).toHaveValue('Unsaved changes');
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(Sentry.captureException).toHaveBeenCalledWith(error);

        await userEvent.click(
          within(dialog).getByRole('button', {name: 'Dismiss error'})
        );
        await waitFor(() => expect(dialog).not.toBeInTheDocument());

        expect(onClose).toHaveBeenCalledWith('close-button');
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('textbox', {name: 'Page draft'})).toBe(draft);
        expect(draft).toHaveFocus();
        await userEvent.type(draft, ' kept');
        expect(draft).toHaveValue('Unsaved changes kept');
      }
    );

    it('can close a failed modal with Escape and open another modal', async () => {
      const {waitForModalToHide} = renderGlobalModal();
      const onClose = jest.fn();

      act(() =>
        openModal(() => <ThrowingModal error={new Error('Modal render failed')} />, {
          closeEvents: 'escape-key',
          onClose,
        })
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitForModalToHide();
      expect(onClose).toHaveBeenCalledWith('escape-key');

      act(() => openModal(({Body}) => <Body>New modal content</Body>));

      expect(screen.getByText('New modal content')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('resets the error when a modal is replaced using the same renderer', () => {
      renderGlobalModal();
      let shouldThrow = true;
      const renderer = () => {
        if (shouldThrow) {
          throw new Error('Modal render failed');
        }
        return <input aria-label="Replacement modal" />;
      };

      act(() => openModal(renderer));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      shouldThrow = false;
      act(() => openModal(renderer));

      expect(
        screen.getByRole('textbox', {name: 'Replacement modal'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('uses actionCreators to open and close Modal', async () => {
    renderGlobalModal();

    act(() => openModal(() => <div data-test-id="modal-test">Hi</div>));

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    act(() => closeModal());

    await waitForElementToBeRemoved(screen.queryByTestId('modal-test'));
    expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when modal is clicked out of', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    await userEvent.click(screen.getByTestId('modal-backdrop'));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when escape key is pressed', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    expect(screen.getByText('Hi')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(({closeModal: cm}) => <button onClick={cm}>Yo</button>, {
        onClose: closeSpy,
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Yo'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores click out with closeEvents: 'escape-key'", async () => {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'escape-key', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    expect(closeSpy).not.toHaveBeenCalled();

    // Pressing escape _does_ close
    await userEvent.keyboard('{Escape}');
    await waitForModalToHide();
    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores escape key with closeEvents: 'backdrop-click'", async () => {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'backdrop-click', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Pressing escape doesn't close
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    expect(closeSpy).not.toHaveBeenCalled();

    // Clicking outside of modal _does_ close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(closeSpy).toHaveBeenCalled();
    await waitForModalToHide();
  });

  it("ignores backdrop click and escape key when with closeEvents: 'none'", async () => {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'none', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(closeSpy).not.toHaveBeenCalled();

    // Pressing escape doesn't close
    await userEvent.keyboard('{Escape}');
    expect(closeSpy).not.toHaveBeenCalled();

    // Clicking an explicit close button does close
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeSpy).toHaveBeenCalled();
    await waitForModalToHide();
  });

  it('does not close modal when pressing escape to close a select dropdown', async () => {
    renderGlobalModal();

    act(() =>
      openModal(({Body}) => (
        <Body>
          <CompactSelect
            options={[
              {value: 'opt1', label: 'Option One'},
              {value: 'opt2', label: 'Option Two'},
            ]}
            value="opt1"
            onChange={() => {}}
          />
        </Body>
      ))
    );

    // Open the select dropdown
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();

    // Press ESC — should close the dropdown, NOT the modal
    await userEvent.keyboard('{Escape}');

    // Dropdown should be closed
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

    // Modal should still be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('restores focus to the button that opened the modal', async () => {
    const {waitForModalToHide} = renderGlobalModal();
    render(
      <button
        onClick={() =>
          openModal(() => (
            <div>
              <input autoFocus />
            </div>
          ))
        }
      >
        Open Modal
      </button>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open Modal'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitForModalToHide();

    expect(screen.getByRole('button', {name: 'Open Modal'})).toHaveFocus();
  });

  it('restores focus to the button focused when a keyboard shortcut opens the modal', async () => {
    const {waitForModalToHide} = renderGlobalModal();
    render(<button>My Button</button>);

    // Simulate keyboard navigation landing on the button
    screen.getByRole('button', {name: 'My Button'}).focus();
    expect(screen.getByRole('button', {name: 'My Button'})).toHaveFocus();

    // Simulate a keyboard shortcut handler (e.g. Cmd+K) opening the modal
    act(() =>
      openModal(() => (
        <div>
          <input autoFocus />
        </div>
      ))
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitForModalToHide();

    expect(screen.getByRole('button', {name: 'My Button'})).toHaveFocus();
  });

  it('renders interactive tooltip inside the modal', async () => {
    renderGlobalModal();

    const buttonClick = jest.fn();

    act(() =>
      openModal(({Body}) => (
        <Body>
          <InfoText title={<button onClick={buttonClick}>Click me</button>}>Hi</InfoText>
        </Body>
      ))
    );

    await userEvent.hover(screen.getByText('Hi'));
    await userEvent.click(await screen.findByText('Click me'));

    expect(buttonClick).toHaveBeenCalled();
  });
});

describe('useModal', () => {
  it('opens and closes modal via hook', async () => {
    renderGlobalModal();

    const {result} = renderHookWithProviders(() => useModal());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openModal(() => <div data-test-id="hook-modal">Hello</div>);
    });

    expect(screen.getByTestId('hook-modal')).toBeInTheDocument();
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeModal();
    });

    await waitForElementToBeRemoved(screen.queryByTestId('hook-modal'));
    expect(result.current.isOpen).toBe(false);
  });
});
