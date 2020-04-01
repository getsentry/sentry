import React from 'react';
import {render} from '@testing-library/react';

import LoadingContainer from 'app/components/loading/loadingContainer';

const loadingContainerChildren = 'hello!';

function renderComponent({
  children = loadingContainerChildren,
  ...props
}: Partial<React.ComponentProps<typeof LoadingContainer>>) {
  const utils = render(
    <LoadingContainer {...props}>
      <div>{children}</div>
    </LoadingContainer>
  );
  return {...utils};
}

// TODO(Priscila): check the loading state tests
describe('LoadingContainer', () => {
  it('default state', () => {
    const {getByText, queryByTestId} = renderComponent({});
    expect(getByText(loadingContainerChildren)).toBeTruthy();
    expect(queryByTestId('loading-indicator')).toBeNull();
  });

  it('handles loading state - with children', () => {
    const {getByText, getByTestId} = renderComponent({
      isLoading: true,
    });
    expect(getByText(loadingContainerChildren)).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('handles loading state - without children', () => {
    const {queryByText, getByTestId} = renderComponent({
      children: null,
      isLoading: true,
    });
    expect(queryByText(loadingContainerChildren)).toBeNull();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('reloading state - with children', () => {
    const {getByText, getByTestId} = renderComponent({
      isReloading: true,
    });
    expect(getByText(loadingContainerChildren)).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('reloading state - without children', () => {
    const {queryByText, getByTestId} = renderComponent({
      children: null,
      isReloading: true,
    });
    expect(queryByText(loadingContainerChildren)).toBeNull();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });
});
