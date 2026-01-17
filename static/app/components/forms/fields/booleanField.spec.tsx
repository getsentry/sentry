import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BooleanField from './booleanField';

describe('BooleanField', () => {
  it('renders a switch with correct initial value', () => {
    render(
      <BooleanField
        name="testField"
        value={false}
        onChange={jest.fn()}
        onBlur={jest.fn()}
      />
    );

    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).not.toBeChecked();
  });

  it('renders checked when value is true', () => {
    render(
      <BooleanField name="testField" value onChange={jest.fn()} onBlur={jest.fn()} />
    );

    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).toBeChecked();
  });

  it('coerces truthy values to true', () => {
    render(
      <BooleanField
        name="testField"
        value="some string"
        onChange={jest.fn()}
        onBlur={jest.fn()}
      />
    );

    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).toBeChecked();
  });

  it('coerces falsy values to false', () => {
    render(
      <BooleanField name="testField" value={0} onChange={jest.fn()} onBlur={jest.fn()} />
    );

    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).not.toBeChecked();
  });

  it('calls onChange and onBlur when toggled', async () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <BooleanField
        name="testField"
        value={false}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );

    const switchElement = screen.getByRole('checkbox');
    await userEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(true, expect.any(Object));
    expect(handleBlur).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it('toggles from true to false', async () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <BooleanField name="testField" value onChange={handleChange} onBlur={handleBlur} />
    );

    const switchElement = screen.getByRole('checkbox');
    await userEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(false, expect.any(Object));
    expect(handleBlur).toHaveBeenCalledWith(false, expect.any(Object));
  });

  it('shows disabled state', () => {
    render(
      <BooleanField
        name="testField"
        value={false}
        disabled
        onChange={jest.fn()}
        onBlur={jest.fn()}
      />
    );

    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).toBeDisabled();
  });

  it('shows tooltip when disabled with reason', async () => {
    render(
      <BooleanField
        name="testField"
        value={false}
        disabled
        disabledReason="This is disabled for a reason"
        onChange={jest.fn()}
        onBlur={jest.fn()}
      />
    );

    const switchElement = screen.getByRole('checkbox');
    await userEvent.hover(switchElement);

    expect(await screen.findByText('This is disabled for a reason')).toBeInTheDocument();
  });

  describe('with confirm', () => {
    it('renders with confirm prop without errors', () => {
      render(
        <BooleanField
          name="testField"
          value={false}
          onChange={jest.fn()}
          onBlur={jest.fn()}
          confirm={{
            true: 'Are you sure you want to enable this?',
          }}
        />
      );

      const switchElement = screen.getByRole('checkbox');
      expect(switchElement).toBeInTheDocument();
    });

    it('renders with dangerous confirm prop without errors', () => {
      render(
        <BooleanField
          name="testField"
          value={false}
          onChange={jest.fn()}
          onBlur={jest.fn()}
          confirm={{
            true: 'This is dangerous!',
            isDangerous: true,
          }}
        />
      );

      const switchElement = screen.getByRole('checkbox');
      expect(switchElement).toBeInTheDocument();
    });
  });
});
