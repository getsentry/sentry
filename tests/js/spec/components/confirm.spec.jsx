import React from 'react';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import Confirm from 'app/components/confirm';

describe('Confirm', function() {
  it('renders', function() {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );
    expect(wrapper).toSnapshot();
  });

  it('clicking action button opens Modal', function() {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    wrapper.find('button').simulate('click');

    expect(wrapper.find('Modal').prop('show')).toBe(true);
  });

  it('clicking action button twice causes Modal to end up closed', function() {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    const button = wrapper.find('button');

    button.simulate('click');
    button.simulate('click');
    expect(wrapper.find('Modal').prop('show')).toBe(false);
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', function() {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('button').simulate('click');
    wrapper.update();

    // Click "Confirm" button, should be last button
    wrapper
      .find('Button')
      .last()
      .simulate('click');

    expect(
      wrapper
        .find('Modal')
        .first()
        .prop('show')
    ).toBe(false);
    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('can stop propagation on the event', function() {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock} stopPropagation>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    expect(mock).not.toHaveBeenCalled();

    const event = {
      stopPropagation: jest.fn(),
    };

    wrapper.find('button').simulate('click', event);
    wrapper.update();

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
