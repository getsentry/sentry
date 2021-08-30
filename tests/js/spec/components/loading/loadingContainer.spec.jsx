import {cleanup, mountWithTheme} from 'sentry-test/reactTestingLibrary';

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
    const {getByText, getByTestId} = renderComponent();
    expect(getByText('hello!')).toBeTruthy();
    expect(() => getByTestId('loading-indicator')).toThrow();
  });

  it('handles loading state', () => {
    const {getByTestId, getByText, rerender, queryByText} = renderComponent({
      isLoading: true,
    });
    expect(getByText('hello!')).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    rerender(<LoadingContainer isLoading />);
    expect(queryByText('hello!')).toBeNull();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('handles reloading state', () => {
    const {getByTestId, getByText, rerender, queryByText} = renderComponent({
      isReloading: true,
    });
    expect(getByText('hello!')).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    rerender(<LoadingContainer isReloading />);
    expect(queryByText('hello!')).toBeNull();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });
});
