import {render, screen} from 'sentry-test/reactTestingLibrary';

import LoadingContainer, {
  LoadingContainerProps,
} from 'sentry/components/loading/loadingContainer';

function renderComponent(props: LoadingContainerProps = {}) {
  return render(
    <LoadingContainer {...props}>
      <div>hello!</div>
    </LoadingContainer>
  );
}

describe('LoadingContainer', () => {
  it('handles normal state', function () {
    renderComponent();
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(() => screen.getByTestId('loading-indicator')).toThrow();
  });

  it('handles loading state', function () {
    const {rerender} = renderComponent({isLoading: true});
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    rerender(<LoadingContainer isLoading />);
    expect(screen.queryByText('hello!')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('handles reloading state', function () {
    const {rerender} = renderComponent({isReloading: true});
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    rerender(<LoadingContainer isReloading />);
    expect(screen.queryByText('hello!')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
});
