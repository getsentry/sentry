import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ErrorBoundary} from './errorBoundary';

describe('ErrorBoundary', () => {
  it('renders components', () => {
    render(
      <ErrorBoundary>
        <HelloComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });

  it('catches component errors', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <HelloComponent />
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/I really did it/)).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('catches string errors', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <HelloComponent />
        <StringErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/I really did it/)).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('renders a custom error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary customComponent={({error}) => <ErrorMessage error={error} />}>
        <HelloComponent />
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.getByTestId('yikes')).toBeInTheDocument();
    expect(screen.getByText(/I really did it/)).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('renders a mini error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary mini>
        <HelloComponent />
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.getByText(/there was a problem/i)).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('retries children when dismissed without an onDismiss callback', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const {rerender} = render(
      <ErrorBoundary mini allowDismiss>
        <ErrorComponent />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary mini allowDismiss>
        <HelloComponent />
      </ErrorBoundary>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss error'}));

    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('lets onDismiss handle dismissal without retrying the children', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onDismiss = jest.fn();
    const {rerender} = render(
      <ErrorBoundary mini allowDismiss onDismiss={onDismiss}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary mini allowDismiss onDismiss={onDismiss}>
        <HelloComponent />
      </ErrorBoundary>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss error'}));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('renders a null custom error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary customComponent={null}>
        <HelloComponent />
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText('hello')).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });
});

function HelloComponent() {
  return <div>hello</div>;
}

function ErrorComponent(): React.ReactNode {
  throw new Error('I really did it this time');
}

function StringErrorComponent(): React.ReactNode {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw 'I really did it this time';
}

function ErrorMessage({error}: {error: Error | null}) {
  return <div data-test-id="yikes">{error?.message}, yikes</div>;
}
