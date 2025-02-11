import {render, screen} from 'sentry-test/reactTestingLibrary';

import ErrorBoundary from './errorBoundary';

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

function ErrorMessage({error}: {error: Error | null}) {
  return <div data-test-id="yikes">{error?.message}, yikes</div>;
}
