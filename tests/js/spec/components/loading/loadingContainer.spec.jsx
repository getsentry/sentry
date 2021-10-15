import {cleanup, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import LoadingContainer from 'app/components/loading/loadingContainer';

function renderComponent(props) {
  return mountWithTheme(
    <LoadingContainer {...props}>
      <div>hello!</div>
    </LoadingContainer>
  );
}

describe('LoadingContainer', () => {
  afterEach(cleanup);

  it('handles normal state', () => {
    renderComponent();
    expect(screen.getByText('hello!')).toBeTruthy();
    expect(() => screen.getByTestId('loading-indicator')).toThrow();
  });

  it('handles loading state', () => {
    const {rerender} = renderComponent({
      isLoading: true,
    });
    expect(screen.getByText('hello!')).toBeTruthy();
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    rerender(<LoadingContainer isLoading />);
    expect(screen.queryByText('hello!')).toBeNull();
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });

  it('handles reloading state', () => {
    const {rerender} = renderComponent({
      isReloading: true,
    });
    expect(screen.getByText('hello!')).toBeTruthy();
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    rerender(<LoadingContainer isReloading />);
    expect(screen.queryByText('hello!')).toBeNull();
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
