import {mountWithTheme} from 'sentry-test/enzyme';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';

describe('RangeSlider', function () {
  it('changes value / has right label', function () {
    const wrapper = mountWithTheme(
      <RangeSlider name="test" value={5} min={0} max={10} onChange={() => {}} />
    );
    expect(wrapper.find('Label').text()).toBe('5');
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(wrapper.find('Label').text()).toBe('7');
  });

  it('can use formatLabel', function () {
    const wrapper = mountWithTheme(
      <RangeSlider
        name="test"
        value={5}
        min={0}
        max={10}
        formatLabel={value => (
          <div className="test">{value === 7 ? 'SEVEN!' : Number(value) + 1}</div>
        )}
        onChange={() => {}}
      />
    );

    const testElement = wrapper.find('.test');
    expect(testElement).toHaveLength(1);
    expect(testElement.text()).toBe('6');
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(wrapper.find('.test').text()).toBe('SEVEN!');
  });

  it('calls onChange', function () {
    const onChange = jest.fn();
    const wrapper = mountWithTheme(
      <RangeSlider name="test" value={5} min={0} max={10} onChange={onChange} />
    );
    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Slider').simulate('input', {target: {value: 7}});
    expect(onChange).toHaveBeenCalledWith(7, expect.anything());
  });

  it('can provide a list of allowedValues', function () {
    const onChange = jest.fn();
    const wrapper = mountWithTheme(
      <RangeSlider
        name="test"
        value={1000}
        min={0}
        max={10}
        allowedValues={[0, 100, 1000, 10000, 20000]}
        onChange={onChange}
      />
    );

    // With `allowedValues` sliderValue will be the index to value in `allowedValues`
    expect(wrapper.find('Label').text()).toBe('1000');

    wrapper.find('Slider').simulate('input', {target: {value: 0}});
    expect(wrapper.find('Label').text()).toBe('0');

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(0, expect.anything());
  });

  it('handles invalid values', function () {
    const onChange = jest.fn();
    const wrapper = mountWithTheme(
      <RangeSlider
        name="test"
        value={1000}
        min={0}
        max={10}
        allowedValues={[0, 100, 1000, 10000, 20000]} // support unsorted arrays?
        onChange={onChange}
      />
    );

    wrapper.find('Slider').simulate('input', {target: {value: -1}});
    expect(wrapper.find('Label').text()).toBe('Invalid value');

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(undefined, expect.anything());
  });
});
