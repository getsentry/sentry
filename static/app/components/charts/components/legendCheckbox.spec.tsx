import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LegendCheckbox} from 'sentry/components/charts/components/legendCheckbox';

describe('LegendCheckbox', () => {
  it('renders checked state with correct background color', () => {
    render(
      <LegendCheckbox checked color="#ff0000" onChange={jest.fn()} aria-label="Toggle" />
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Toggle'});
    expect(checkbox).toBeChecked();
  });

  it('renders unchecked state with transparent background', () => {
    render(
      <LegendCheckbox
        checked={false}
        color="#ff0000"
        onChange={jest.fn()}
        aria-label="Toggle"
      />
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Toggle'});
    expect(checkbox).not.toBeChecked();
  });

  it('calls onChange when clicked', async () => {
    const onChange = jest.fn();
    render(
      <LegendCheckbox
        checked={false}
        color="#ff0000"
        onChange={onChange}
        aria-label="Toggle"
      />
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Toggle'}));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies aria-label to native checkbox', () => {
    render(
      <LegendCheckbox
        checked={false}
        color="#ff0000"
        onChange={jest.fn()}
        aria-label="Toggle series"
      />
    );

    expect(screen.getByRole('checkbox', {name: 'Toggle series'})).toBeInTheDocument();
  });

  it('is checked when checked prop is true', () => {
    render(<LegendCheckbox checked color="#ff0000" onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('is unchecked when checked prop is false', () => {
    render(<LegendCheckbox checked={false} color="#ff0000" onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
