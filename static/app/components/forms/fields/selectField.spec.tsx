import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SelectField} from './selectField';

describe('legacy SelectField options', () => {
  it('uses the placeholder for an empty selection and only lists real choices', async () => {
    const onChange = jest.fn();
    render(
      <SelectField
        name="fruit"
        label="Fruit"
        value={null}
        placeholder="Choose fruit"
        choices={[
          ['apple', 'Apple'],
          ['cherry', 'Cherry'],
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Choose fruit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await userEvent.click(screen.getByRole('option', {name: 'Apple'}));
    expect(onChange).toHaveBeenCalledWith('apple', expect.anything());
  });

  it('shows field errors in the indicators and retains the clear control', async () => {
    const onChange = jest.fn();
    const {rerender} = render(
      <SelectField
        name="fruit"
        label="Fruit"
        value="apple"
        choices={[['apple', 'Apple']]}
        allowClear
        error="Invalid fruit"
        onChange={onChange}
      />
    );

    expect(await screen.findByText('Invalid fruit')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(onChange).toHaveBeenCalledWith(null, expect.anything());

    rerender(
      <SelectField
        name="fruit"
        label="Fruit"
        value="apple"
        choices={[['apple', 'Apple']]}
        allowClear
        error="Invalid fruit"
        hideControlState
      />
    );

    expect(screen.queryByText('Invalid fruit')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Clear choices')).toBeInTheDocument();
  });

  it('converts choices and returns the selected raw value', async () => {
    const onChange = jest.fn();
    render(
      <SelectField
        name="fruit"
        label="Fruit"
        value="apple"
        choices={[
          ['apple', 'Apple'],
          ['cherry', 'Cherry'],
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Apple')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
    await userEvent.click(screen.getByRole('option', {name: 'Cherry'}));

    expect(onChange).toHaveBeenCalledWith('cherry', expect.anything());
  });

  it('resolves functional choices with the field props', async () => {
    render(
      <SelectField
        name="fruit"
        label="Fruit"
        choices={props => [[String(props.value), 'Selected fruit']]}
        value="apple"
      />
    );

    expect(screen.getByText('Selected fruit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
    expect(screen.getByRole('option', {name: 'Selected fruit'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('prefers explicit options for both the selected value and the menu', async () => {
    render(
      <SelectField
        name="fruit"
        label="Fruit"
        value="apple"
        options={[{value: 'apple', label: 'Apple'}]}
        choices={[[1, 'Legacy choice']]}
      />
    );

    expect(screen.getByText('Apple')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
    expect(screen.getByRole('option', {name: 'Apple'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('option', {name: 'Legacy choice'})).not.toBeInTheDocument();
  });

  it('supports creatable fields without predefined choices', () => {
    render(<SelectField name="tag" label="Tag" creatable value="New tag" />);

    expect(screen.getByText('New tag')).toBeInTheDocument();
  });
});
