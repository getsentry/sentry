import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FruitMultiValueLabel, options, ThemeWrapper} from '../../test/selectFixtures';

import {Select} from './select';

it('customizes chip labels while retaining the remove control', async () => {
  const onChange = jest.fn();
  render(
    <Select
      multiple
      clearable
      aria-label="Fruit"
      options={options}
      value={['apple', 'cherry']}
      onChange={onChange}
      components={{MultiValueLabel: FruitMultiValueLabel}}
    />,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('Apple: Fruit')).toBeInTheDocument();
  await userEvent.click(screen.getAllByLabelText('Remove item')[0]!);

  expect(onChange).toHaveBeenCalledWith([options[1]]);
});

it('removes the last selected item with Backspace when the search is empty', async () => {
  const onChange = jest.fn();
  render(
    <Select
      multiple
      aria-label="Fruit"
      options={options}
      value={['apple', 'cherry']}
      onChange={onChange}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.tab();
  await userEvent.keyboard('a{Backspace}');
  expect(screen.getByRole('combobox', {name: 'Fruit'})).toHaveValue('');
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.keyboard('{Backspace}');
  expect(onChange).toHaveBeenCalledWith([options[0]]);
});

it('announces the focused chip and removes it with Backspace', async () => {
  const onChange = jest.fn();
  render(
    <Select
      multiple
      aria-label="Fruit"
      options={options}
      value={['apple', 'cherry']}
      onChange={onChange}
      isOpen={false}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.tab();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();

  await userEvent.keyboard('{ArrowLeft}');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Cherry, 2 of 2. Press Backspace to remove.'
  );

  await userEvent.keyboard('{ArrowLeft}');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Apple, 1 of 2. Press Backspace to remove.'
  );
  expect(screen.getByRole('combobox', {name: 'Fruit'})).toHaveFocus();

  await userEvent.keyboard('{Backspace}');
  expect(onChange).toHaveBeenCalledWith([options[1]]);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('keeps the last selected item on Backspace when clearable is false', async () => {
  const onChange = jest.fn();
  render(
    <Select
      multiple
      clearable={false}
      aria-label="Fruit"
      options={options}
      value={['apple', 'cherry']}
      onChange={onChange}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.tab();
  await userEvent.keyboard('{Backspace}');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', {name: 'Clear choices'})).not.toBeInTheDocument();
});

it('clears all selected items in a multi-select by default', async () => {
  const onChange = jest.fn();
  render(
    <Select
      multiple
      aria-label="Fruit"
      options={options}
      value={['apple', 'cherry']}
      onChange={onChange}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.click(screen.getByRole('button', {name: 'Clear choices'}));
  expect(onChange).toHaveBeenCalledWith([]);
});
