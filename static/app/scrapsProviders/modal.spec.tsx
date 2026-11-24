import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerBody, useDrawer} from '@sentry/scraps/drawer';
import {GlobalModal, openModal} from '@sentry/scraps/modal';

import {ErrorBoundary} from 'sentry/components/errorBoundary';

function ThrowingModal({error}: {error: Error}): React.ReactNode {
  throw error;
}

function DrawerWithModal() {
  const {openDrawer} = useDrawer();
  return (
    <button
      onClick={() =>
        openDrawer(
          () => (
            <DrawerBody>
              <button
                onClick={() =>
                  openModal(({Header, Body}) => (
                    <Fragment>
                      <Header closeButton>Modal above drawer</Header>
                      <Body>
                        <button>Modal action</button>
                      </Body>
                    </Fragment>
                  ))
                }
              >
                Open modal
              </button>
            </DrawerBody>
          ),
          {ariaLabel: 'Underlying drawer'}
        )
      }
    >
      Open drawer
    </button>
  );
}

describe('GlobalModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the app route without closing on query or hash changes', async () => {
    const onClose = jest.fn();
    const {router} = render(<GlobalModal />, {
      initialRouterConfig: {location: {pathname: '/first/'}},
    });
    act(() => openModal(({Body}) => <Body>Route-bound dialog</Body>, {onClose}));
    router.navigate('/first/?page=2#section');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    router.navigate('/second/');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the drawer and its scroll lock when the modal is used and closed', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <DrawerWithModal />
      </Fragment>
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open drawer'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Open modal'}));
    await userEvent.click(screen.getByRole('button', {name: 'Modal action'}));
    expect(
      screen.getByRole('complementary', {name: 'Underlying drawer'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      screen.getByRole('complementary', {name: 'Underlying drawer'})
    ).toBeInTheDocument();
    expect(document.body).toHaveStyle({position: 'fixed'});
  });

  it('preserves Escape behavior when a modal is above a drawer', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <DrawerWithModal />
      </Fragment>
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open drawer'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Open modal'}));
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', {name: 'Underlying drawer'})
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();

    // Press ESC — should close the dropdown, NOT the modal
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
