import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {LoadingContainerProps} from 'sentry/components/loading/loadingContainer';
import {LoadingContainer} from 'sentry/components/loading/loadingContainer';

function ExampleLoadingContainer(props: LoadingContainerProps) {
  return (
    <LoadingContainer {...props}>
      <div>hello!</div>
    </LoadingContainer>
  );
}

describe('LoadingContainer', () => {
  it('handles normal state', () => {
    render(<ExampleLoadingContainer />);
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(() => screen.getByTestId('loading-indicator')).toThrow();
  });

  it('handles loading state', () => {
    const {rerender} = render(<ExampleLoadingContainer isLoading />);
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    rerender(<LoadingContainer isLoading />);
    expect(screen.queryByText('hello!')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('handles reloading state', () => {
    const {rerender} = render(<ExampleLoadingContainer isReloading />);
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    rerender(<LoadingContainer isReloading />);
    expect(screen.queryByText('hello!')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
});
