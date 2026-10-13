import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {toast} from '@sentry/scraps/toast';

describe('Toast', () => {
  it.each([
    ['success', 'status', 'Success', () => toast.success('Success')],
    ['error', 'alert', 'Error', () => toast.error('Error')],
    ['loading', 'status', 'Loading', () => toast.loading('Loading')],
    ['default', 'status', 'Message', () => toast.message('Message')],
  ] as const)('renders the %s variant', async (_variant, role, message, showToast) => {
    render(<div />);

    act(() => void showToast());

    expect(await screen.findByRole(role)).toHaveTextContent(message);
  });

  it('does not dismiss when the toast body is clicked', async () => {
    render(<div />);
    act(() => void toast.message('Dismiss me', {duration: Infinity}));

    const toastElement = await screen.findByRole('status');
    await userEvent.click(toastElement);

    expect(toastElement).toBeInTheDocument();
  });

  it('dismisses when the close button is clicked', async () => {
    render(<div />);
    act(() => void toast.message('Dismiss me', {duration: Infinity}));

    await userEvent.click(await screen.findByRole('button', {name: 'Dismiss'}));

    await waitForElementToBeRemoved(() => screen.queryByRole('status'));
  });

  it('dismisses all toasts', async () => {
    render(<div />);
    act(() => {
      toast.error('First error', {duration: Infinity});
      toast.error('Second error', {duration: Infinity});
      toast.error('Third error', {id: 'third-error', duration: Infinity});
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

  it('dismisses automatically after the configured duration', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();

    try {
      render(<div />);
      act(() => void toast.message('Temporary', {duration: 1000, onDismiss}));
      expect(await screen.findByRole('status')).toHaveTextContent('Temporary');

      act(() => jest.advanceTimersByTime(1000));
      act(() => jest.runAllTimers());

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stacks toasts of the same variant', async () => {
    render(<div />);
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

  it('uses a consistent width and wraps long messages', async () => {
    render(<div />);
    const message =
      'This is a long toast message that should wrap onto multiple lines instead of being truncated.';

    act(() => void toast.message(message, {duration: Infinity}));

    const toastElement = await screen.findByRole('status');
    const toaster = toastElement.closest<HTMLElement>('[data-sonner-toaster]');
    const messageElement = screen.getByText(message);

    expect(toaster).not.toBeNull();
    expect(getEmotionRules(toaster!).join('')).toMatch(
      /width:\s*min\(400px,\s*-60px \+ 100vw\)/
    );
    expect(getEmotionRules(messageElement).join('')).toMatch(/white-space:\s*normal/);
    expect(getEmotionRules(messageElement).join('')).toMatch(/word-break:\s*break-word/);
  });

  it('dismisses toasts when the variant changes', async () => {
    render(<div />);
    act(() => void toast.loading('Loading', {duration: Infinity}));

    expect(await screen.findByText('Loading')).toBeInTheDocument();

    act(() => void toast.success('Success', {duration: Infinity}));

    await waitForElementToBeRemoved(() => screen.queryByText('Loading'));
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('keeps explicit IDs separate from automatic replacement', async () => {
    render(<div />);
    act(() => {
      toast.message('Other notification', {duration: Infinity});
      toast.loading('Loading', {id: 'operation', duration: Infinity});
    });

    expect(await screen.findByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('Other notification')).toBeInTheDocument();

    act(() => void toast.success('Success', {duration: Infinity}));

    await waitForElementToBeRemoved(() => screen.queryByText('Other notification'));
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('updates only the given id when its variant changes', async () => {
    let toastId: string | number = '';

    render(<div />);
    act(() => {
      toastId = toast.loading('Loading', {duration: Infinity});
      toast.loading('Other operation', {duration: Infinity});
    });

    expect(await screen.findByText('Loading')).toBeInTheDocument();

    act(() => void toast.success('Success', {duration: Infinity, id: toastId}));

    expect(await screen.findByText('Success')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    expect(screen.getByText('Other operation')).toBeInTheDocument();

    act(() => void toast.message('Other notification', {duration: Infinity}));
    await waitForElementToBeRemoved(() => screen.queryByText('Other operation'));
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('runs an action and dismisses the toast', async () => {
    const onClick = jest.fn();
    render(<div />);
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
});
