import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import SelectField from 'sentry/components/deprecatedforms/selectField';

describe('SelectField', function () {
  it('renders without form context', function () {
    const {container} = render(
      <SelectField
        options={[
          {label: 'a', value: 'a'},
          {label: 'b', value: 'b'},
        ]}
        name="fieldName"
        value="a"
      />
    );
    expect(container).toSnapshot();
  });

  it('renders with flat options', function () {
    const {container} = render(
      <SelectField choices={['a', 'b', 'c']} name="fieldName" />
    );
    expect(container).toSnapshot();
  });

  it('renders with paired options', function () {
    const {container} = render(
      <SelectField
        options={[
          {value: 'a', label: 'abc'},
          {value: 'b', label: 'bcd'},
          {value: 'c', label: 'cde'},
        ]}
        name="fieldName"
      />
    );
    expect(container).toSnapshot();
  });

  it('can change value and submit', async function () {
    const mock = jest.fn();
    render(
      <Form onSubmit={mock}>
        <SelectField
          options={[
            {label: 'a', value: 'a'},
            {label: 'b', value: 'b'},
          ]}
          name="fieldName"
        />
        <button type="submit">submit</button>
      </Form>
    );
    await selectEvent.select(screen.getByText('Select...'), 'a');
    await userEvent.click(screen.getByText('submit'));
    expect(mock).toHaveBeenCalledWith(
      {fieldName: 'a'},
      expect.anything(),
      expect.anything()
    );
  });

  it('can set the value to empty string via props with no options', async function () {
    const mock = jest.fn();
    const {rerender} = render(
      <SelectField
        options={[
          {label: 'a', value: 'a'},
          {label: 'b', value: 'b'},
        ]}
        name="fieldName"
        onChange={mock}
      />
    );
    // Select a value so there is an option selected.
    await selectEvent.select(screen.getByText('Select...'), 'a');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith('a');

    // Update props to remove value and options.
    rerender(<SelectField options={[]} value="" name="fieldName" onChange={mock} />);

    // second update.
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenLastCalledWith('');
  });

  describe('Multiple', function () {
    it('selects multiple values and submits', async function () {
      const mock = jest.fn();
      render(
        <Form onSubmit={mock}>
          <SelectField
            multiple
            options={[
              {label: 'a', value: 'a'},
              {label: 'b', value: 'b'},
            ]}
            name="fieldName"
          />
          <button type="submit">submit</button>
        </Form>
      );
      await selectEvent.select(screen.getByText('Select...'), 'a');
      await userEvent.click(screen.getByText('submit'));
      expect(mock).toHaveBeenCalledWith(
        {fieldName: ['a']},
        expect.anything(),
        expect.anything()
      );
    });
  });
});
