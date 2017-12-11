import React from 'react';
import {shallow} from 'enzyme';
import Confirm from 'app/components/confirm';

describe('Confirm', function() {
  it('renders', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('clicking action button opens Modal', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    wrapper.find('button').simulate('click');

    expect(wrapper.find('Modal').prop('show')).toBe(true);
  });

  it('clicking action button twice causes Modal to end up closed', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    let button = wrapper.find('button');

    button.simulate('click');
    button.simulate('click');
    expect(wrapper.find('Modal').prop('show')).toBe(false);
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('button').simulate('click');
    wrapper.update();

    // Click "Confirm" button, should be last button
    wrapper
      .find('Modal')
      .find('Button')
      .last()
      .simulate('click');

    expect(wrapper.find('Modal').prop('show')).toBe(false);
    expect(mock).toHaveBeenCalled();
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', function() {
    let mock = jest.fn();
    let wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('button').simulate('click');
    wrapper.update();

    // Click "Confirm" button, should be last button
    let confirm = wrapper
      .find('Modal')
      .find('Button')
      .last();

    confirm.simulate('click');
    confirm.simulate('click');

    expect(wrapper.find('Modal').prop('show')).toBe(false);
    expect(mock.mock.calls).toHaveLength(1);
  });
});
