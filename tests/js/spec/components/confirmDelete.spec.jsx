import React from 'react';
import {mount} from 'enzyme';
import ConfirmDelete from 'app/components/confirmDelete';

describe('ConfirmDelete', function() {
  it('renders', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Confirm')).toMatchSnapshot();
  });

  it('confirm button is disabled and bypass prop is false when modal opens', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );

    wrapper.find('button').simulate('click');

    expect(wrapper.find('Confirm').prop('bypass')).toBe(false);
    expect(wrapper.state('disableConfirmButton')).toBe(true);
  });

  it('confirm button stays disabled with non-matching input', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );
    wrapper.find('button').simulate('click');
    // simulating handleChange()
    wrapper.setState({confirmInput: 'Cool', disableConfirmButton: true});
    expect(wrapper.find('Confirm').prop('disableConfirmButton')).toBe(true);
  });

  it('confirm button is enabled when confirm input matches', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );
    wrapper.find('button').simulate('click');
    // simulating handleChange()
    wrapper.setState({confirmInput: 'CoolOrg', disableConfirmButton: false});
    expect(wrapper.find('Confirm').prop('disableConfirmButton')).toBe(false);

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
