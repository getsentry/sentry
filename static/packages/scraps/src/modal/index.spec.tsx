import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {InfoText} from '@sentry/scraps/info';
import {GlobalModal, openModal, closeModal, useModal} from '@sentry/scraps/modal';
import {OverlayContextProvider} from '@sentry/scraps/overlayContext';
import {lightTheme} from '@sentry/scraps/theme';

function wrapper({children}: React.PropsWithChildren) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

beforeAll(() => {
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  closeModal();
});

afterAll(() => {
  jest.restoreAllMocks();
});

it('renders a request opened before the host mounts', () => {
  openModal(({Body}) => <Body>Already open</Body>);
  render(<GlobalModal />, {wrapper});
  expect(screen.getByRole('dialog')).toHaveTextContent('Already open');
});

it('hides the standalone background and restores it on unmount', () => {
  const background = document.createElement('main');
  background.setAttribute('aria-hidden', 'false');
  document.body.appendChild(background);
  const {unmount} = render(<GlobalModal />, {wrapper});
  try {
    act(() => openModal(({Body}) => <Body>Accessible dialog</Body>));
    expect(background).toHaveAttribute('aria-hidden', 'true');
    // oxlint-disable-next-line testing-library/no-node-access -- Check the portal's accessibility and container styles.
    const portal = screen.getByRole('dialog').closest('[data-overlay="modal"]');
    expect(portal).not.toHaveAttribute('aria-hidden', 'true');
    expect(portal).toHaveStyle({containerType: 'inline-size'});
    unmount();
    expect(background).not.toHaveAttribute('aria-hidden', 'true');
  } finally {
    background.remove();
  }
});

it('restores the supplied app root attribute after closing', async () => {
  const root = document.createElement('main');
  root.setAttribute('aria-hidden', 'false');
  document.body.appendChild(root);
  render(
    <OverlayContextProvider value={{modal: {getAppElement: () => root}}}>
      <GlobalModal />
    </OverlayContextProvider>,
    {wrapper}
  );
  try {
    act(() => openModal(({Header}) => <Header closeButton>Root integration</Header>));
    expect(root).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(root).toHaveAttribute('aria-hidden', 'false');
  } finally {
    root.remove();
  }
});

it('closes only on pathname changes and skips the onClose callback', async () => {
  const onClose = jest.fn();
  openModal(({Body}) => <Body>Route integration</Body>, {onClose});
  const {rerender} = render(
    <OverlayContextProvider value={{location: {pathname: '/first', query: {}}}}>
      <GlobalModal />
    </OverlayContextProvider>,
    {wrapper}
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  rerender(
    <OverlayContextProvider
      value={{location: {pathname: '/first', query: {page: '2'}, hash: '#section'}}}
    >
      <GlobalModal />
    </OverlayContextProvider>
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  rerender(
    <OverlayContextProvider value={{location: {pathname: '/second', query: {}}}}>
      <GlobalModal />
    </OverlayContextProvider>
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(onClose).not.toHaveBeenCalled();
});

describe('standalone error recovery', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('contains renderer errors and resets a failed renderer for a new open', async () => {
    render(<GlobalModal />, {wrapper});
    let shouldThrow = true;
    const renderer = () => {
      if (shouldThrow) {
        throw new Error('Dialog failed');
      }
      return <input aria-label="Recovered draft" />;
    };
    act(() => openModal(renderer));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'There was a problem rendering the dialog.'
    );
    shouldThrow = false;
    act(() => openModal(renderer));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Recovered draft'}),
      'Kept'
    );
    act(() => openModal(renderer));
    expect(screen.getByRole('textbox', {name: 'Recovered draft'})).toHaveValue('Kept');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can dismiss a failed dialog when automatic dismissal is disabled', async () => {
    const onClose = jest.fn();
    render(<GlobalModal />, {wrapper});
    act(() =>
      openModal(
        () => {
          throw new Error('Dialog failed');
        },
        {closeEvents: 'none', onClose}
      )
    );
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss error'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClose).toHaveBeenCalledWith('close-button');
  });
});

it('preserves a healthy modal when opened again', async () => {
  render(<GlobalModal />, {wrapper});
  const renderer = () => <input aria-label="Modal draft" />;

  act(() => openModal(renderer));
  await userEvent.type(screen.getByRole('textbox', {name: 'Modal draft'}), 'Unsaved');

  act(() => openModal(renderer));

  expect(screen.getByRole('textbox', {name: 'Modal draft'})).toHaveValue('Unsaved');
});

it('opens and closes through package actions', async () => {
  render(<GlobalModal />, {wrapper});

  act(() => openModal(() => <div data-test-id="modal-test">Hi</div>));

  expect(screen.getByTestId('modal-test')).toBeInTheDocument();

  act(() => closeModal());

  await waitForElementToBeRemoved(screen.queryByTestId('modal-test'));
  expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
});

it('calls onClose handler when close button is clicked', async () => {
  render(<GlobalModal />, {wrapper});
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
  render(<GlobalModal />, {wrapper});
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
  render(<GlobalModal />, {wrapper});
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
  render(<GlobalModal />, {wrapper});
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
  render(<GlobalModal />, {wrapper});
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

  await userEvent.click(screen.getByTestId('modal-backdrop'));
  expect(screen.getByTestId('modal-test')).toBeInTheDocument();
  expect(closeSpy).not.toHaveBeenCalled();

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(closeSpy).toHaveBeenCalled();
});

it("ignores escape key with closeEvents: 'backdrop-click'", async () => {
  render(<GlobalModal />, {wrapper});
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

  await userEvent.keyboard('{Escape}');
  expect(screen.getByTestId('modal-test')).toBeInTheDocument();
  expect(closeSpy).not.toHaveBeenCalled();

  await userEvent.click(screen.getByTestId('modal-backdrop'));
  expect(closeSpy).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it("ignores backdrop click and escape key when with closeEvents: 'none'", async () => {
  render(<GlobalModal />, {wrapper});
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

  await userEvent.click(screen.getByTestId('modal-backdrop'));
  expect(closeSpy).not.toHaveBeenCalled();

  await userEvent.keyboard('{Escape}');
  expect(closeSpy).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  expect(closeSpy).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('restores focus to the button that opened the modal', async () => {
  render(<GlobalModal />, {wrapper});
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
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  expect(screen.getByRole('button', {name: 'Open Modal'})).toHaveFocus();
});

it('restores focus to the button focused when a keyboard shortcut opens the modal', async () => {
  render(<GlobalModal />, {wrapper});
  render(<button>My Button</button>);

  screen.getByRole('button', {name: 'My Button'}).focus();
  expect(screen.getByRole('button', {name: 'My Button'})).toHaveFocus();

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
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  expect(screen.getByRole('button', {name: 'My Button'})).toHaveFocus();
});

it('renders interactive tooltip inside the modal', async () => {
  render(<GlobalModal />, {wrapper});

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

describe('useModal', () => {
  it('opens and closes modal via hook', async () => {
    render(<GlobalModal />, {wrapper});

    const {result} = renderHook(() => useModal());

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
