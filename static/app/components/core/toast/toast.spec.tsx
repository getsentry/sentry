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
    ['success', 'toast-success', () => toast.success('Success')],
    ['error', 'toast-error', () => toast.error('Error')],
    ['loading', 'toast-loading', () => toast.loading('Loading')],
    ['default', 'toast', () => toast.message('Message')],
  ] as const)('renders the %s variant', async (_variant, testId, showToast) => {
    render(<div />);

    act(() => void showToast());

    const toastElement = await screen.findByTestId(testId);
    expect(toastElement).toHaveTextContent(/Success|Error|Loading|Message/);

    if (testId === 'toast-loading') {
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    } else if (testId === 'toast-success' || testId === 'toast-error') {
      expect(toastElement.querySelector('svg')).toBeInTheDocument();
    }
  });

  it('does not dismiss when the toast body is clicked', async () => {
    render(<div />);
    act(() => void toast.message('Dismiss me', {duration: Infinity}));

    const toastElement = await screen.findByTestId('toast');
    await userEvent.click(toastElement);

    expect(screen.getByTestId('toast')).toBeInTheDocument();
  });

  it('dismisses when the close button is clicked', async () => {
    render(<div />);
    act(() => void toast.message('Dismiss me', {duration: Infinity}));

    await userEvent.click(await screen.findByRole('button', {name: 'Dismiss'}));

    await waitForElementToBeRemoved(() => screen.queryByTestId('toast'));
  });

  it('does not dismiss when dismissible is false', async () => {
    render(<div />);
    act(() => void toast.message('Keep me', {duration: Infinity, dismissible: false}));

    const toastElement = await screen.findByTestId('toast');
    await userEvent.click(toastElement);

    expect(screen.getByTestId('toast')).toBeInTheDocument();
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
      expect(await screen.findByTestId('toast')).toHaveTextContent('Temporary');

      act(() => jest.advanceTimersByTime(1000));
      act(() => jest.runAllTimers());

      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
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
    expect(screen.getAllByTestId('toast-error')).toHaveLength(3);
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
