import React from 'react';

import {mountWithTheme, mount} from 'sentry-test/enzyme';

import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';

describe('MultipleCheckbox', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <MultipleCheckbox
        choices={[
          [0, 'Choice A'],
          [1, 'Choice B'],
          [2, 'Choice C'],
        ]}
        value={[1]}
      />
    );

    expect(wrapper).toSnapshot();
  });

  it('unselects a checked input', function () {
    const onChange = jest.fn();
    const wrapper = mount(
      <MultipleCheckbox
        choices={[
          [0, 'Choice A'],
          [1, 'Choice B'],
          [2, 'Choice C'],
        ]}
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

  it('selects an unchecked input', function () {
    const onChange = jest.fn();
    const wrapper = mount(
      <MultipleCheckbox
        choices={[
          [0, 'Choice A'],
          [1, 'Choice B'],
          [2, 'Choice C'],
        ]}
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
