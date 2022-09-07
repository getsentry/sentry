import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';

describe('RangeSlider', function () {
  it('changes value / has right label', function () {
    render(<RangeSlider name="test" value={5} min={0} max={10} onChange={() => {}} />);
    expect(screen.getByRole('slider', {name: '5'})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), {target: {value: '7'}});
    expect(screen.getByRole('slider', {name: '7'})).toBeInTheDocument();
  });

  it('can use formatLabel', function () {
    render(
      <RangeSlider
        name="test"
        value={5}
        min={0}
        max={10}
        formatLabel={value => (
          <div data-test-id="test">{value === 7 ? 'SEVEN!' : Number(value) + 1}</div>
        )}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('test')).toHaveTextContent('6');

    fireEvent.change(screen.getByRole('slider'), {target: {value: '7'}});
    expect(screen.getByTestId('test')).toHaveTextContent('SEVEN!');
  });

  it('calls onChange', function () {
    const onChange = jest.fn();
    render(<RangeSlider name="test" value={5} min={0} max={10} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('slider'), {target: {value: '7'}});
    expect(onChange).toHaveBeenCalledWith(7, expect.anything());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('can provide a list of allowedValues', function () {
    const onChange = jest.fn();
    render(
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
    expect(screen.getByRole('slider', {name: '1000'})).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider'), {target: {value: '0'}});
    expect(screen.getByRole('slider', {name: '0'})).toBeInTheDocument();

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(0, expect.anything());
  });

  it('handles invalid values', function () {
    const onChange = jest.fn();
    render(
      <RangeSlider
        name="test"
        value={1000}
        min={0}
        max={10}
        allowedValues={[0, 100, 1000, 10000, 20000]} // support unsorted arrays?
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('slider'), {target: {value: '-2'}});
    expect(screen.getByRole('slider', {name: '0'})).toBeInTheDocument();

    // onChange will callback with a value from `allowedValues`
    expect(onChange).toHaveBeenCalledWith(0, expect.anything());
  });
});
