import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import LazyLoad from 'app/components/lazyLoad';

describe('LazyLoad', function() {
  it('renders with a loading indicator when promise is not resolved yet', function() {
    const promise = new Promise(() => {});
    const getComponent = () => promise;
    const wrapper = mountWithTheme(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('renders when given a promise of a "button" component', async function() {
    let res;
    const promise = new Promise(resolve => {
      res = resolve;
    });
    const getComponent = () => promise;
    const wrapper = mountWithTheme(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);

    // resolve with button
    const ResolvedComponent = 'button';
    res(ResolvedComponent);

    await promise;
    // Need to wait for `retryableImport` to resolve
    await tick();
    wrapper.update();
    expect(wrapper.state('Component')).toEqual('button');
    expect(wrapper.find('button')).toHaveLength(1);
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
  });

  it('renders with error message when promise is rejected', async function() {
    // eslint-disable-next-line no-console
    console.error = jest.fn();
    const getComponent = jest.fn(
      () =>
        new Promise((_resolve, reject) => reject(new Error('Could not load component')))
    );
    let wrapper;

    try {
      wrapper = mountWithTheme(<LazyLoad component={getComponent} />);
    } catch (err) {
      // ignore
    }

    // Need to wait for `retryableImport` to resolve
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(wrapper.find('LoadingError')).toHaveLength(1);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });

  it('refetches when component changes', async function() {
    const getComponent = jest.fn(() => new Promise());
    const wrapper = mountWithTheme(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    expect(getComponent).toHaveBeenCalled();

    // Update component prop
    const getComponent2 = jest.fn(() => new Promise());
    wrapper.setProps({component: getComponent2});
    expect(getComponent2).toHaveBeenCalledTimes(1);

    // Does not refetch on other prop changes
    wrapper.setProps({testProp: true});
    expect(getComponent2).toHaveBeenCalledTimes(1);
  });
});
