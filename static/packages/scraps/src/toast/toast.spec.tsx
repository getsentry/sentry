import type {ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';
import {
  act,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';
import {toast, ToastProvider} from '@sentry/scraps/toast';

// jsdom does not implement pointer capture, which Sonner uses for swipe dismissal.
HTMLElement.prototype.setPointerCapture ??= jest.fn();

function ToastTestProviders({children}: {children: ReactNode}) {
  return (
    <ThemeProvider theme={lightTheme}>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  act(() => void toast.dismiss());
});

describe('Toast', () => {
  it.each([
    ['success', 'status', 'Success', () => toast.success('Success')],
    ['error', 'alert', 'Error', () => toast.error('Error')],
    ['loading', 'status', 'Loading', () => toast.loading('Loading')],
    ['default', 'status', 'Message', () => toast.message('Message')],
  ] as const)('renders the %s variant', async (_variant, role, message, showToast) => {
    render(<div />, {wrapper: ToastTestProviders});

    act(() => void showToast());

    expect(await screen.findByRole(role)).toHaveTextContent(message);
  });

  it('does not dismiss when the toast body is clicked', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => void toast.message('Dismiss me', {duration: Infinity}));

    const toastElement = await screen.findByRole('status');
    await userEvent.click(toastElement);

    expect(toastElement).toBeInTheDocument();
  });

  it('dismisses when the close button is clicked', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => void toast.message('Dismiss me', {duration: Infinity}));

    await userEvent.click(await screen.findByRole('button', {name: 'Dismiss'}));

    await waitForElementToBeRemoved(() => screen.queryByRole('status'));
  });

  it('dismisses all toasts', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => {
      toast.error('First error', {duration: Infinity});
      toast.error('Second error', {duration: Infinity});
      toast.error('Third error', {duration: Infinity});
    });

    expect(await screen.findByText('First error')).toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.getByText('Third error')).toBeInTheDocument();

    act(() => void toast.dismiss());

    await waitFor(() => {
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
      expect(screen.queryByText('Second error')).not.toBeInTheDocument();
      expect(screen.queryByText('Third error')).not.toBeInTheDocument();
    });
  });

  describe('automatic dismissal', () => {
    beforeEach(() => jest.useFakeTimers());

    afterEach(() => {
      try {
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    it('dismisses after the configured duration', async () => {
      const onDismiss = jest.fn();
      render(<div />, {wrapper: ToastTestProviders});
      act(() => void toast.message('Temporary', {duration: 1000, onDismiss}));
      expect(await screen.findByRole('status')).toHaveTextContent('Temporary');

      act(() => jest.advanceTimersByTime(1000));
      act(() => jest.runAllTimers());

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  it('stacks toasts of the same variant', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => {
      toast.error('First error', {duration: Infinity});
      toast.error('Second error', {duration: Infinity});
      toast.error('Third error', {duration: Infinity});
    });

    expect(await screen.findByText('First error')).toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.getByText('Third error')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });

  it('dismisses toasts when the variant changes', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => void toast.loading('Loading', {duration: Infinity}));

    expect(await screen.findByText('Loading')).toBeInTheDocument();

    act(() => void toast.success('Success', {duration: Infinity}));

    await waitForElementToBeRemoved(() => screen.queryByText('Loading'));
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('updates a toast when its variant changes', async () => {
    let toastId: string | number = '';

    render(<div />, {wrapper: ToastTestProviders});
    act(() => {
      toastId = toast.loading('Loading', {duration: Infinity});
    });

    expect(await screen.findByText('Loading')).toBeInTheDocument();

    act(() => void toast.success('Success', {duration: Infinity, id: toastId}));

    expect(await screen.findByText('Success')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('runs an action and dismisses the toast', async () => {
    const onClick = jest.fn();
    render(<div />, {wrapper: ToastTestProviders});
    act(
      () =>
        void toast.message('Undoable', {
          duration: Infinity,
          action: {label: 'Undo', onClick},
        })
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Undo'}));

    expect(onClick).toHaveBeenCalledTimes(1);
    await waitForElementToBeRemoved(() => screen.queryByText('Undoable'));
  });

  it('hides overflow toasts from assistive technology and keyboard navigation', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => {
      for (let index = 0; index < 4; index++) {
        toast.message(`Message ${index}`, {
          duration: Infinity,
          action: {label: `Action ${index}`, onClick: jest.fn()},
        });
      }
    });

    expect(await screen.findByText('Message 3')).toBeVisible();
    expect(screen.getByText('Message 0')).not.toBeVisible();
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.queryByRole('button', {name: 'Action 0'})).not.toBeInTheDocument();

    for (let index = 0; index < 12; index++) {
      await userEvent.tab();
      expect(screen.getByLabelText('Action 0')).not.toHaveFocus();
    }
  });

  it('keeps the loading indicator self-contained', async () => {
    render(<div />, {wrapper: ToastTestProviders});
    act(() => void toast.loading('Loading', {duration: Infinity}));

    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByTestId('loading-indicator')).toHaveClass('scraps-spinner');
    expect(screen.getByTestId('loading-indicator')).toHaveStyle({margin: '0px'});
  });

  it('can unmount and remount the provider without duplicating toasts', async () => {
    const {unmount} = render(<div />, {wrapper: ToastTestProviders});
    act(() => void toast.message('Persistent', {duration: Infinity}));
    expect(await screen.findByRole('status')).toHaveTextContent('Persistent');

    unmount();
    act(() => void toast.dismiss());
    render(<div />, {wrapper: ToastTestProviders});
    act(() => void toast.success('New notification', {duration: Infinity}));

    expect(await screen.findByRole('status')).toHaveTextContent('New notification');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByText('Persistent')).not.toBeInTheDocument();
  });
});
