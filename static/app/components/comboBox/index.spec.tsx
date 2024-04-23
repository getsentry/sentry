import {Fragment} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ComboBox} from 'sentry/components/comboBox';

describe('ComboBox', function () {
  it('renders', async function () {
    render(
      <ComboBox
        aria-label="Test Input"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(await screen.findByRole('combobox', {name: 'Test Input'})).toBeEnabled();
  });

  it('renders disabled', async function () {
    render(
      <ComboBox
        disabled
        aria-label="Test Input"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(await screen.findByRole('combobox', {name: 'Test Input'})).toBeDisabled();
  });

  it('can be dismissed', async function () {
    render(
      <Fragment>
        <ComboBox
          value="opt_one"
          aria-label="Input One"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
        <ComboBox
          value="opt_three"
          aria-label="Input Two"
          options={[
            {value: 'opt_three', label: 'Option Three'},
            {value: 'opt_four', label: 'Option Four'},
          ]}
        />
      </Fragment>
    );

    const input1 = screen.getByRole('combobox', {name: 'Input One'});
    // const input2 = screen.getByRole('combobox', {name: 'Input Two'});

    // Can be dismissed by clicking outside
    await userEvent.click(input1);
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    await userEvent.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });

    // Can be dismissed by pressing Escape
    await userEvent.click(input1);
    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });
  });

  it('can search', async function () {
    render(
      <ComboBox
        aria-label="Test Input"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('combobox'));

    // type 'Two' into the search box
    await userEvent.keyboard('Two');

    // only Option Two should be available, Option One should be filtered out
    expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
  });
});

describe('ListBox', function () {
  it('can select options with values containing quotes', async function () {
    const mock = jest.fn();
    render(
      <ComboBox
        aria-label="Test Input"
        options={[
          {value: '"opt_one"', label: 'Option One'},
          {value: '"opt_two"', label: 'Option Two'},
        ]}
        onChange={mock}
      />
    );
    // click on the trigger button
    await userEvent.click(screen.getByRole('combobox'));
    // select Option One & Option Two
    await userEvent.click(screen.getByRole('option', {name: 'Option One'}));
    expect(mock).toHaveBeenCalledWith({value: '"opt_one"', label: 'Option One'});

    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', {name: 'Option Two'}));
    expect(mock).toHaveBeenCalledWith({value: '"opt_two"', label: 'Option Two'});
  });
});
