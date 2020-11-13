import React from 'react';

import {mount, shallow} from 'sentry-test/enzyme';

import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

describe('RangeSlider', function () {
  const creator = props => (
    <RangeSlider name="test" value={5} min={0} max={10} onChange={() => {}} {...props} />
  );

  it('changes value', function () {
    const wrapper = shallow(creator());
    expect(wrapper.state('sliderValue')).toBe(5);
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(wrapper.state('sliderValue')).toBe(7);
  });

  it('has right label', function () {
    const wrapper = mount(creator());
    expect(wrapper.find('Label').text()).toBe('5');
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(wrapper.find('Label').text()).toBe('7');
  });

  it('can use formatLabel', function () {
    const wrapper = mount(
      creator({
        formatLabel: value => (
          <div className="test">{value === 7 ? 'SEVEN!' : value + 1}</div>
        ),
      })
    );
    expect(wrapper.find('.test')).toHaveLength(1);
    expect(wrapper.find('.test').text()).toBe('6');
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(wrapper.find('.test').text()).toBe('SEVEN!');
  });

  it('calls onChange', function () {
    const onChange = jest.fn();
    const wrapper = shallow(
      creator({
        onChange,
      })
    );
    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(onChange).toHaveBeenCalledWith(7, expect.anything());
  });

  it('can provide a list of allowedValues', function () {
    const onChange = jest.fn();
    const wrapper = mount(
      creator({
        // support unsorted arrays?
        allowedValues: [0, 100, 1000, 10000, 20000],
        value: 1000,
        onChange,
      })
    );

    // With `allowedValues` sliderValue will be the index to value in `allowedValues`
    expect(wrapper.state('sliderValue')).toBe(2);
    expect(wrapper.find('Label').text()).toBe('1000');

    wrapper.find('Slider').simulate('input', {target: {value: 0}});
    expect(wrapper.state('sliderValue')).toBe(0);
    expect(wrapper.find('Label').text()).toBe('0');

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(0, expect.anything());
  });

  it('handles invalid values', function () {
    const onChange = jest.fn();
    const wrapper = mount(
      creator({
        // support unsorted arrays?
        allowedValues: [0, 100, 1000, 10000, 20000],
        value: 1000,
        onChange,
      })
    );

    wrapper.find('Slider').simulate('input', {target: {value: -1}});
    expect(wrapper.state('sliderValue')).toBe(-1);
    expect(wrapper.find('Label').text()).toBe('Invalid value');

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(undefined, expect.anything());
  });
});
