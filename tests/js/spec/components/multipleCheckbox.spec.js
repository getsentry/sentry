import React from 'react';
import {shallow, mount} from 'enzyme';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';

describe('MultipleCheckbox', function() {
  it('renders', function() {
    let wrapper = shallow(
      <MultipleCheckbox
        choices={[[0, 'Choice A'], [1, 'Choice B'], [2, 'Choice C']]}
        value={[1]}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('unselects a checked input', function() {
    let onChange = jest.fn();
    let wrapper = mount(
      <MultipleCheckbox
        choices={[[0, 'Choice A'], [1, 'Choice B'], [2, 'Choice C']]}
        value={[1]}
        onChange={onChange}
      />
    );

    wrapper
      .find('input')
      .at(1)
      .simulate('change', {target: {checked: false}});
    expect(onChange).toHaveBeenCalledWith([], expect.anything());
  });

  it('selects an unchecked input', function() {
    let onChange = jest.fn();
    let wrapper = mount(
      <MultipleCheckbox
        choices={[[0, 'Choice A'], [1, 'Choice B'], [2, 'Choice C']]}
        value={[1]}
        onChange={onChange}
      />
    );

    wrapper
      .find('input')
      .at(0)
      .simulate('change', {target: {checked: true}});
    expect(onChange).toHaveBeenCalledWith([1, 0], expect.anything());
  });
});
