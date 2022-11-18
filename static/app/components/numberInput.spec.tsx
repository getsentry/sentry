import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import NumberInput from 'sentry/components/numberInput';

describe('NumberInput', function () {
  it('renders input', function () {
    render(<NumberInput value={5} aria-label="Test Number Input" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(5);
  });

  it('responds to key presses', function () {
    render(<NumberInput defaultValue={5} aria-label="Test Number Input" />);

    const input = screen.getByRole('spinbutton');
    userEvent.type(input, '{ArrowDown}');
    expect(input).toHaveValue(4);

    userEvent.type(input, '{ArrowUp>2}');
    expect(input).toHaveValue(6);
  });

  it('forces min/max values', function () {
    render(
      <NumberInput min={0} max={10} defaultValue={5} aria-label="Test Number Input" />
    );

    const input = screen.getByRole('spinbutton');

    // Should not be able to press arrow down to get below 0
    userEvent.type(input, '{ArrowDown>5}');
    expect(input).toHaveValue(0);
    userEvent.type(input, '{ArrowDown}');
    expect(input).toHaveValue(0);

    // Should not be able to press arrow up to get above 10
    userEvent.type(input, '{ArrowUp>10}');
    expect(input).toHaveValue(10);
    userEvent.type(input, '{ArrowUp}');
    expect(input).toHaveValue(10);

    // Type "100"
    userEvent.type(input, '0');
    expect(input).toHaveValue(100);
    // Click outside the input, the value should be clamped down to 10
    userEvent.click(document.body);
    expect(input).toHaveValue(10);
  });
});
