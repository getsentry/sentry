import {Fragment} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expectTypeOf} from 'expect-type';

import {ThemeWrapper} from '../../test/selectFixtures';

import {Select} from './select';
import type {SelectValue} from './types';

it('preserves creatable values with an empty options list', () => {
  render(
    <Fragment>
      <Select<string> onChange={jest.fn()} creatable options={[]} value="New fruit" />
      <Select<string>
        onChange={jest.fn()}
        creatable
        multiple
        options={[]}
        value={['New tag']}
      />
    </Fragment>,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('New fruit')).toBeInTheDocument();
  expect(screen.getByText('New tag')).toBeInTheDocument();
});

it('returns a string option when creating a choice alongside numeric options', async () => {
  const options = [{value: 42, label: 'Answer', details: 'A supplied option'}];
  const onChange = jest.fn();
  render(
    <Select
      aria-label="Answer"
      creatable
      options={options}
      value={null}
      onChange={option => {
        expectTypeOf(option).toEqualTypeOf<
          (typeof options)[number] | SelectValue<number | string>
        >();
        onChange(option);
      }}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.type(screen.getByRole('combobox', {name: 'Answer'}), 'New answer');
  await userEvent.click(screen.getByRole('option', {name: 'Create "New answer"'}));

  expect(onChange).toHaveBeenCalledWith({value: 'New answer', label: 'New answer'});
});

it('hides Create when the query exactly matches an option’s textValue', async () => {
  const option = {
    value: 'team-1',
    label: <strong>Team One</strong>,
    textValue: 'Team One',
  };
  const onChange = jest.fn();
  render(
    <Select
      aria-label="Choices"
      creatable
      options={[option]}
      value={null}
      onChange={onChange}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.type(screen.getByRole('combobox', {name: 'Choices'}), 'team one');

  expect(
    screen.queryByRole('option', {name: 'Create "team one"'})
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', {name: 'Team One'}));
  expect(onChange).toHaveBeenCalledWith(option);
});
