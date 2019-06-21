import React from 'react';

import {mount} from 'sentry-test/enzyme';
import LazyLoad from 'app/components/lazyLoad';

describe('LazyLoad', function() {
  it('renders with a loading indicator when promise is not resolved yet', function() {
    const promise = new Promise((resolve, reject) => {});
    const getComponent = () => promise;
    const wrapper = mount(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(wrapper.find('LoadingContainer')).toHaveLength(1);
  });

  it('renders with error message when promise is rejected', async function() {
    // eslint-disable-next-line no-console
    console.error = jest.fn();
    const getComponent = jest.fn(
      () =>
        new Promise((resolve, reject) => reject(new Error('Could not load component')))
    );
    let wrapper;

    try {
      wrapper = mount(<LazyLoad component={getComponent} />);
    } catch (err) {
      // ignore
    }

    // Need to wait for `retryableImport` to resolve
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingContainer')).toHaveLength(0);
    expect(wrapper.find('LoadingError')).toHaveLength(1);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });
});
