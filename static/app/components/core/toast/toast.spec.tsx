import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

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

  it('does not dismiss when dismissible is false', async () => {
    render(<div />);
    act(() => void toast.message('Keep me', {duration: Infinity, dismissible: false}));

    const toastElement = await screen.findByRole('status');
    await userEvent.click(toastElement);

    expect(toastElement).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Dismiss'})).not.toBeInTheDocument();
  });

  it('dismisses all toasts', async () => {
    render(<div />);
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

  it('dismisses automatically after the configured duration', async () => {
    jest.useFakeTimers();

    try {
      render(<div />);
      act(() => void toast.message('Temporary', {duration: 1000}));
      expect(await screen.findByRole('status')).toHaveTextContent('Temporary');

      act(() => jest.advanceTimersByTime(1000));
      act(() => jest.runAllTimers());

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

  it('dismisses toasts when the variant changes', async () => {
    render(<div />);
    act(() => void toast.loading('Loading', {duration: Infinity}));

    expect(await screen.findByText('Loading')).toBeInTheDocument();

    act(() => void toast.success('Success', {duration: Infinity}));

    await waitForElementToBeRemoved(() => screen.queryByText('Loading'));
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
