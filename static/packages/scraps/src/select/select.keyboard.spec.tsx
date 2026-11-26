import {Fragment} from 'react';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Button} from '@sentry/scraps/button';

import {options, ThemeWrapper} from '../../test/selectFixtures';

import {Select} from './select';

it('leaves the current choice unchanged when Tab moves past an open select', async () => {
  const onChange = jest.fn();
  render(
    <Fragment>
      <Select aria-label="Fruit" options={options} value="apple" onChange={onChange} />
      <Button>Next field</Button>
    </Fragment>,
    {wrapper: ThemeWrapper}
  );

  const input = screen.getByRole('combobox', {name: 'Fruit'});
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowDown}');
  expect(input).toHaveAttribute(
    'aria-activedescendant',
    screen.getByRole('option', {name: 'Cherry'}).id
  );

  await userEvent.tab();
  expect(screen.getByRole('button', {name: 'Next field'})).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it('opens on the selected option when pressing Down from a closed select', async () => {
  const intervals = [
    {value: '5m', label: 'in 5 minutes'},
    {value: '15m', label: 'in 15 minutes'},
    {value: '1h', label: 'in one hour'},
  ];
  const onChange = jest.fn();
  render(
    <Select
      aria-label="Alert interval"
      options={intervals}
      value="15m"
      onChange={onChange}
      menuPortalTarget={document.body}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.tab();
  const input = screen.getByRole('combobox', {name: 'Alert interval'});
  expect(input).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

  await userEvent.keyboard('{ArrowDown}');
  expect(input).toHaveAttribute(
    'aria-activedescendant',
    screen.getByRole('option', {name: 'in 15 minutes'}).id
  );
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledWith(
    {value: '1h', label: 'in one hour'},
    expect.objectContaining({action: 'select-option'})
  );
});

it('selects the first search match when the selected option still matches', async () => {
  const onChange = jest.fn();
  render(
    <Select aria-label="Fruit" options={options} value="cherry" onChange={onChange} />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.tab();
  await userEvent.keyboard('e{Enter}');

  expect(onChange).toHaveBeenCalledWith(options[0], expect.anything());
});

it('runs the caller keyboard handler before opening or choosing options', async () => {
  const onOpenChange = jest.fn();
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value={null}
      onChange={jest.fn()}
      onOpenChange={onOpenChange}
      onKeyDown={event => event.preventDefault()}
    />,
    {wrapper: ThemeWrapper}
  );

  act(() => screen.getByRole('combobox', {name: 'Fruit'}).focus());
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
});

it.each([true, false])(
  'opens the menu and then selects an option with Space (searchable: %s)',
  async searchable => {
    const onChange = jest.fn();
    render(
      <Select
        aria-label="Fruit"
        options={options}
        value={null}
        onChange={onChange}
        searchable={searchable}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.tab();
    await userEvent.keyboard('[Space]');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Fruit'})).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard('[Space]');

    expect(onChange.mock.calls[0]?.[0]).toBe(options[0]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  }
);

it('inserts Space into an active search query', async () => {
  const onChange = jest.fn();
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value={[]}
      onChange={onChange}
      multiple
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.tab();
  await userEvent.keyboard('apple[Space]');

  expect(screen.getByRole('combobox', {name: 'Fruit'})).toHaveValue('apple ');
  expect(screen.getByRole('option', {name: 'Apple'})).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps the controlled menu closed while entering text', async () => {
  const onInputChange = jest.fn();
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value={null}
      onChange={jest.fn()}
      onInputChange={onInputChange}
      isOpen={false}
    />,
    {wrapper: ThemeWrapper}
  );

  const input = screen.getByRole('combobox', {name: 'Fruit'});
  await userEvent.type(input, 'a');
  await userEvent.keyboard('{ArrowDown}');
  expect(input).toHaveValue('a');
  expect(onInputChange).toHaveBeenCalledWith('a', 'input');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('tabs to a footer button outside a portaled listbox', async () => {
  const onChange = jest.fn();
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value={null}
      onChange={onChange}
      menuPortalTarget={document.body}
      menuFooter={<Button>Manage fruit</Button>}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
  await userEvent.tab();
  expect(screen.getByRole('button', {name: 'Manage fruit'})).toHaveFocus();
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it('preserves the active option when object choices refetch and reorder', async () => {
  const first = {label: 'Apple', value: {id: 1}};
  const second = {label: 'Cherry', value: {id: 2}};
  const isValueEqual = (a: {id: number}, b: {id: number}) => a.id === b.id;
  const onChange = jest.fn();
  const {rerender} = render(
    <Select
      aria-label="Fruit"
      options={[first, second]}
      value={null}
      onChange={onChange}
      isValueEqual={isValueEqual}
    />,
    {wrapper: ThemeWrapper}
  );

  const input = screen.getByRole('combobox', {name: 'Fruit'});
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowDown}');
  const activeId = screen.getByRole('option', {name: 'Cherry'}).id;
  expect(input).toHaveAttribute('aria-activedescendant', activeId);

  const updatedCherry = {label: 'Cherry', value: {id: 2}};
  rerender(
    <Select
      aria-label="Fruit"
      options={[updatedCherry, first]}
      value={null}
      onChange={onChange}
      isValueEqual={isValueEqual}
    />
  );
  expect(input).toHaveAttribute('aria-activedescendant', activeId);

  await userEvent.keyboard('{Enter}');
  expect(onChange.mock.calls[0]?.[0]).toBe(updatedCherry);
});
