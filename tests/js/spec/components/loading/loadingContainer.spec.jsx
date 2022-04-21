import {cleanup, render, screen} from 'sentry-test/reactTestingLibrary';

import LoadingContainer from 'sentry/components/loading/loadingContainer';

function renderComponent(props) {
  return render(
    <LoadingContainer {...props}>
      <div>hello!</div>
    </LoadingContainer>
  );
}

describe('LoadingContainer', () => {
  afterEach(cleanup);

  it('handles normal state', () => {
    renderComponent();
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(() => screen.getByTestId('loading-indicator')).toThrow();
  });

  it('handles loading state', () => {
    const {rerender} = renderComponent({
      isLoading: true,
    });
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    rerender(<LoadingContainer isLoading />);
    expect(screen.queryByText('hello!')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('handles reloading state', () => {
    const {rerender} = renderComponent({
      isReloading: true,
    });
    expect(screen.getByText('hello!')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    rerender(<LoadingContainer isReloading />);
    expect(screen.queryByText('hello!')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
});
