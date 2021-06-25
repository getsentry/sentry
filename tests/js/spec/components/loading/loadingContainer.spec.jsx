import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import LoadingContainer from 'app/components/loading/loadingContainer';

function renderComponent(props) {
  return mountWithTheme(
    <LoadingContainer {...props}>
      <div>hello!</div>
    </LoadingContainer>
  );
}

describe('LoadingContainer', function () {
  it('handles normal state', () => {
    const {getByText, getByTestId, unmount} = renderComponent();
    expect(getByText('hello!')).toBeTruthy();
    expect(() => getByTestId('loading-indicator')).toThrow();
    unmount();
  });

  it('handles loading state', () => {
    const {getByTestId, getByText, rerender, queryByText, unmount} = renderComponent({
      isLoading: true,
    });
    expect(getByText('hello!')).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    rerender(<LoadingContainer isLoading />);
    expect(queryByText('hello!')).toBeNull();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    unmount();
  });

  it('handles reloading state', () => {
    const {getByTestId, getByText, rerender, queryByText, unmount} = renderComponent({
      isReloading: true,
    });
    expect(getByText('hello!')).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    rerender(<LoadingContainer isReloading />);
    expect(queryByText('hello!')).toBeNull();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    unmount();
  });
});
