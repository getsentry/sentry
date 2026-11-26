import {createRef, Fragment, useState} from 'react';
import {useFloating} from '@floating-ui/react-dom';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {
  FruitOptionLabel,
  FruitValue,
  options,
  ThemeWrapper,
} from '../../test/selectFixtures';

import {Select} from './select';
import type {SelectHandle} from './types';

jest.mock('@floating-ui/react-dom', () => {
  const floating = jest.requireActual('@floating-ui/react-dom');
  return {...floating, useFloating: jest.fn(floating.useFloating)};
});

it.each([
  {menuAlign: undefined, placement: 'bottom-start'},
  {menuAlign: 'end', placement: 'bottom-end'},
] as const)('opens the options at $placement', async ({menuAlign, placement}) => {
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value={null}
      menuAlign={menuAlign}
      onChange={() => {}}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));

  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(useFloating).toHaveBeenLastCalledWith(expect.objectContaining({placement}));
});

it('customizes value and option content while preserving selection data', async () => {
  const onChange = jest.fn();
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value="apple"
      onChange={onChange}
      components={{Value: FruitValue, OptionLabel: FruitOptionLabel}}
    />,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('Selected Apple')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
  await userEvent.click(screen.getByRole('option', {name: 'Choose Cherry'}));

  expect(onChange).toHaveBeenCalledWith(options[1], expect.anything());
});

it('shows trailing items alongside the clear button', async () => {
  const onChange = jest.fn();
  render(
    <Select
      clearable
      options={options}
      value="apple"
      onChange={onChange}
      trailingItems={<Text>Saved</Text>}
    />,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('Saved')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Clear choices'));
  expect(onChange).toHaveBeenCalledWith(null, expect.anything());
});

it('keeps option selection and clearing available when the chevron is hidden', async () => {
  const onChange = jest.fn();
  render(
    <Select
      clearable
      aria-label="Fruit"
      options={options}
      value="apple"
      onChange={onChange}
      dropdownIndicator={null}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.click(screen.getByRole('button', {name: 'Clear choices'}));
  expect(onChange).toHaveBeenCalledWith(null, expect.anything());
  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
  await userEvent.click(screen.getByRole('option', {name: 'Cherry'}));
  expect(onChange).toHaveBeenCalledWith(options[1], expect.anything());
});

it('provides a native input ref and forwards validation attributes', () => {
  const inputRef = createRef<HTMLInputElement>();
  const {unmount} = render(
    <Select
      value={null}
      onChange={jest.fn()}
      aria-label="Fruit"
      aria-invalid
      aria-describedby="fruit-error"
      inputRef={inputRef}
      options={options}
    />,
    {wrapper: ThemeWrapper}
  );

  const input = screen.getByRole('combobox', {name: 'Fruit'});
  expect(inputRef.current).toBe(input);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAttribute('aria-describedby', 'fruit-error');

  unmount();
  expect(inputRef.current).toBeNull();
});

it('renders disabled selections without an onChange handler', async () => {
  render(
    <Fragment>
      <Select disabled aria-label="Single fruit" options={options} value="apple" />
      <Select
        disabled
        multiple
        aria-label="Multiple fruit"
        options={options}
        value={['cherry']}
      />
    </Fragment>,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByLabelText('Single fruit')).toBeDisabled();
  expect(screen.getByLabelText('Multiple fruit')).toBeDisabled();
  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Cherry')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Apple'));
  await userEvent.click(screen.getByText('Cherry'));
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
});

it('exposes focus and blur without access to the implementation instance', () => {
  const ref = createRef<SelectHandle>();
  render(
    <Select
      value={null}
      onChange={jest.fn()}
      ref={ref}
      aria-label="Fruit"
      options={options}
    />,
    {wrapper: ThemeWrapper}
  );
  const input = screen.getByRole('combobox', {name: 'Fruit'});

  act(() => ref.current?.focus());
  expect(input).toHaveFocus();
  act(() => ref.current?.blur());
  expect(input).not.toHaveFocus();
});

function ControlledSelect({onOpenChange}: {onOpenChange: (open: boolean) => void}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Select
      value={null}
      onChange={jest.fn()}
      aria-label="Fruit"
      options={options}
      isOpen={isOpen}
      onOpenChange={open => {
        onOpenChange(open);
        setIsOpen(open);
      }}
      menuFooter={<Button>Manage fruit</Button>}
    />
  );
}

it('controls the menu and keeps footer actions outside the options', async () => {
  const onOpenChange = jest.fn();
  render(<ControlledSelect onOpenChange={onOpenChange} />, {wrapper: ThemeWrapper});

  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', {name: 'Manage fruit'})).toBeInTheDocument();
  for (const option of screen.getAllByRole('option')) {
    expect(
      within(option).queryByRole('button', {name: 'Manage fruit'})
    ).not.toBeInTheDocument();
  }

  await userEvent.keyboard('{Escape}');
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('button', {name: 'Manage fruit'})).not.toBeInTheDocument();
});

it('uses raw values for controlled single and multiple selections', () => {
  render(
    <Fragment>
      <Select
        onChange={jest.fn()}
        aria-label="Single fruit"
        options={options}
        value="apple"
      />
      <Select
        onChange={jest.fn()}
        multiple
        aria-label="Multiple fruit"
        options={options}
        value={['cherry']}
      />
    </Fragment>,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Cherry')).toBeInTheDocument();
});

it.each([false, true])(
  'changes selection only when the value prop changes (multiple: %s)',
  async multiple => {
    const onChange = jest.fn();
    const selection = multiple
      ? {multiple: true as const, value: ['apple']}
      : {value: 'apple'};
    const {rerender} = render(
      <Select {...selection} aria-label="Fruit" options={options} onChange={onChange} />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
    await userEvent.click(screen.getByRole('option', {name: 'Cherry'}));
    await userEvent.keyboard('{Escape}');

    expect(onChange).toHaveBeenCalledWith(
      multiple ? options : options[1],
      expect.anything()
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument();

    const updatedSelection = multiple
      ? {multiple: true as const, value: ['cherry']}
      : {value: 'cherry'};
    rerender(
      <Select
        {...updatedSelection}
        aria-label="Fruit"
        options={options}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Cherry')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  }
);

it('blurs single selects after selection and reports edits and resets separately', async () => {
  const onInputChange = jest.fn();
  render(
    <Select
      value={null}
      onChange={jest.fn()}
      aria-label="Fruit"
      options={options}
      onInputChange={onInputChange}
    />,
    {wrapper: ThemeWrapper}
  );
  const input = screen.getByRole('combobox', {name: 'Fruit'});

  await userEvent.type(input, 'App');
  expect(onInputChange).toHaveBeenLastCalledWith('App', 'input');
  expect(onInputChange).toHaveBeenCalledTimes(3);

  await userEvent.click(screen.getByRole('option', {name: 'Apple'}));
  await waitFor(() => expect(input).not.toHaveFocus());
  expect(onInputChange).toHaveBeenLastCalledWith('', 'reset');
  expect(
    onInputChange.mock.calls.filter(([, reason]) => reason === 'input')
  ).toHaveLength(3);
});

it('keeps multiple selects focused after selection', async () => {
  render(
    <Select
      value={[]}
      onChange={jest.fn()}
      multiple
      aria-label="Fruit"
      options={options}
    />,
    {wrapper: ThemeWrapper}
  );
  const input = screen.getByRole('combobox', {name: 'Fruit'});

  await userEvent.click(input);
  await userEvent.click(screen.getByRole('option', {name: 'Apple'}));

  expect(input).toHaveFocus();
  expect(screen.getByRole('option', {name: 'Cherry'})).toBeInTheDocument();
});

it('can retain focus in a single select without firing blur', async () => {
  const onBlur = jest.fn();
  render(
    <Select
      value={null}
      onChange={jest.fn()}
      aria-label="Fruit"
      options={options}
      blurInputOnSelect={false}
      onBlur={onBlur}
    />,
    {wrapper: ThemeWrapper}
  );
  const input = screen.getByRole('combobox', {name: 'Fruit'});

  await userEvent.click(input);
  await userEvent.click(screen.getByRole('option', {name: 'Apple'}));

  expect(input).toHaveFocus();
  expect(onBlur).not.toHaveBeenCalled();
});

it('matches letters in order when searching options', async () => {
  render(
    <Select value={null} onChange={jest.fn()} aria-label="Fruit" options={options} />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.type(screen.getByRole('combobox', {name: 'Fruit'}), 'PPL');

  expect(screen.getByRole('option', {name: 'Apple'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: 'Cherry'})).not.toBeInTheDocument();
});

it('filters numeric labels as text', async () => {
  render(
    <Select
      value={null}
      onChange={jest.fn()}
      aria-label="Number"
      options={[{value: 'one', label: 123}]}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.type(screen.getByRole('combobox', {name: 'Number'}), '123');

  expect(screen.getByRole('option', {name: '123'})).toBeInTheDocument();
});

it('passes option data directly to custom filters', async () => {
  render(
    <Select
      value={null}
      onChange={jest.fn()}
      aria-label="Fruit"
      options={options}
      filterOption={option => option.value === 'cherry'}
    />,
    {wrapper: ThemeWrapper}
  );

  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
  expect(screen.getByRole('option', {name: 'Cherry'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: 'Apple'})).not.toBeInTheDocument();
});

it('shows the placeholder for an empty selection without adding menu options', async () => {
  render(
    <Select
      onChange={jest.fn()}
      aria-label="Fruit"
      options={options}
      value={null}
      placeholder="Choose fruit"
    />,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('Choose fruit')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox', {name: 'Fruit'}));
  expect(screen.getAllByRole('option')).toHaveLength(options.length);
  expect(screen.getByRole('option', {name: 'Apple'})).not.toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(screen.getByRole('option', {name: 'Cherry'})).not.toHaveAttribute(
    'aria-selected',
    'true'
  );
});
