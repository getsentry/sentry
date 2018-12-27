import React from 'react';
import {shallow, mount} from 'enzyme';
import Confirm from 'app/components/confirm';

describe('Confirm', function() {
  it('renders', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('clicking action button opens Modal', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    wrapper.find('button').simulate('click');

    expect(wrapper.find('Modal').prop('show')).toBe(true);
  });

  it('clicking action button twice causes Modal to end up closed', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    let button = wrapper.find('button');

    button.simulate('click');
    button.simulate('click');
    expect(wrapper.find('Modal').prop('show')).toBe(false);
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', function() {
    let mock = jest.fn();
    let wrapper = mount(
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
});
