import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import {RangeSlider} from 'sentry/components/forms/controls/rangeSlider';

describe('RangeSlider', () => {
  it('changes value / has right label', () => {
    render(
      <RangeSlider
        name="test"
        value={5}
        allowedValues={[0, 1, 2, 3, 4, 5, 6, 7]}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('slider')).toHaveValue('5');
    fireEvent.change(screen.getByRole('slider'), {target: {value: '7'}});
    expect(screen.getByRole('slider')).toHaveValue('7');
  });

  it('calls onChange', () => {
    const onChange = jest.fn();
    render(
      <RangeSlider
        name="test"
        value={5}
        allowedValues={[0, 1, 2, 3, 4, 5, 6, 7]}
        onChange={onChange}
      />
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('slider'), {target: {value: '7'}});
    expect(onChange).toHaveBeenCalledWith(7, expect.anything());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('can provide a list of allowedValues', () => {
    const onChange = jest.fn();
    render(
      <RangeSlider
        name="test"
        value={1000}
        allowedValues={[0, 100, 1000, 10000, 20000]}
        onChange={onChange}
      />
    );

    // With `allowedValues` sliderValue will be the index to value in `allowedValues`
    expect(screen.getByRole('slider')).toHaveValue('2');

    // Bounded by the maximum allowed value index
    fireEvent.change(screen.getByRole('slider'), {target: {value: '10'}});
    expect(screen.getByRole('slider')).toHaveValue('4');

    fireEvent.change(screen.getByRole('slider'), {target: {value: '0'}});
    expect(screen.getByRole('slider')).toHaveValue('0');

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(0, expect.anything());
  });

  it('handles invalid values', () => {
    const onChange = jest.fn();
    render(
      <RangeSlider
        name="test"
        value={1000}
        allowedValues={[0, 100, 1000, 10000, 20000]} // support unsorted arrays?
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('slider'), {target: {value: '-2'}});
    expect(screen.getByRole('slider')).toHaveValue('0');

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(0, expect.anything());
  });
});
