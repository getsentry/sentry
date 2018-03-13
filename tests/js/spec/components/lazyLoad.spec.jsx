import React from 'react';
import {shallow, mount} from 'enzyme';
import LazyLoad from 'app/components/lazyLoad';

jest.mock('raven-js');

describe('LazyLoad', function() {
  it('renders with a loading indicator when promise is not resolved yet', function() {
    let promise = new Promise((resolve, reject) => {});
    let getComponent = () => promise;
    let wrapper = shallow(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(wrapper.find('LoadingIndicator').length).toBe(1);
  });

  it('renders when given a promise of a "button" component', async function() {
    let res;
    let promise = new Promise((resolve, reject) => {
      res = resolve;
    });
    let getComponent = () => promise;
    let wrapper = mount(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(wrapper.find('LoadingIndicator').length).toBe(1);

    // resolve with button
    let ResolvedComponent = 'button';
    res(ResolvedComponent);

    await promise;
    wrapper.update();
    expect(wrapper.state('Component')).toEqual('button');
    expect(wrapper.find('button').length).toBe(1);
    expect(wrapper.find('LoadingIndicator').length).toBe(0);
  });

  it('renders with error message when promise is rejected', async function() {
    // eslint-disable-next-line no-console
    console.error = jest.fn();
    let reject;
    let promise = new Promise((resolve, rej) => {
      reject = rej;
    });
    let getComponent = () => promise;
    let wrapper;

    try {
      wrapper = mount(<LazyLoad component={getComponent} />);

      reject(new Error('Could not load component'));
      await promise;
    } catch (err) {
      // ignore
    }

    wrapper.update();
    expect(wrapper.find('LoadingIndicator').length).toBe(0);
    expect(wrapper.find('LoadingError').length).toBe(1);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });
});
