import {createRef, Fragment, useState} from 'react';
import {expectTypeOf} from 'expect-type';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {Select} from './select';
import type {ControlProps} from './select';
import type {SelectComponents, SelectHandle, SelectValue} from './types';

const options = [
  {value: 'apple', label: 'Apple', details: 'Fruit'},
  {value: 'cherry', label: 'Cherry', details: 'Fruit'},
];

function FruitValue({option}: {option: (typeof options)[number]}) {
  return <Text>Selected {option.label}</Text>;
}

function FruitOptionLabel({option}: {option: (typeof options)[number]}) {
  return <Text>Choose {option.label}</Text>;
}

function FruitMultiValueLabel({
  option,
  children,
}: {
  children: React.ReactNode;
  option: (typeof options)[number];
}) {
  return (
    <Text>
      {children}: {option.details}
    </Text>
  );
}

function FruitIndicators({children}: {children: React.ReactNode}) {
  return (
    <Fragment>
      <Text>Fruit indicators</Text>
      {children}
    </Fragment>
  );
}

describe('selection types', () => {
  it('checks option types and required props for content components', () => {
    type Option = (typeof options)[number];
    type ValueComponent = NonNullable<SelectComponents<Option>['Value']>;
    type OptionLabel = NonNullable<SelectComponents<Option>['OptionLabel']>;
    type MultiValueLabel = NonNullable<SelectComponents<Option>['MultiValueLabel']>;
    type Indicators = NonNullable<SelectComponents<Option>['Indicators']>;

    expectTypeOf<typeof FruitValue>().toMatchTypeOf<ValueComponent>();
    expectTypeOf<typeof FruitOptionLabel>().toMatchTypeOf<OptionLabel>();
    expectTypeOf<typeof FruitMultiValueLabel>().toMatchTypeOf<MultiValueLabel>();
    expectTypeOf<typeof FruitIndicators>().toMatchTypeOf<Indicators>();
    expectTypeOf<
      (props: {option: SelectValue<number>}) => React.ReactNode
    >().not.toMatchTypeOf<ValueComponent>();
    expectTypeOf<
      (props: {option: SelectValue<number>}) => React.ReactNode
    >().not.toMatchTypeOf<OptionLabel>();
    expectTypeOf<
      (props: {children: React.ReactNode; option: SelectValue<number>}) => React.ReactNode
    >().not.toMatchTypeOf<MultiValueLabel>();
    expectTypeOf<
      (props: {children: React.ReactNode; required: string}) => React.ReactNode
    >().not.toMatchTypeOf<Indicators>();
    expectTypeOf<'Input' | 'Control' | 'Option'>().not.toMatchTypeOf<
      keyof SelectComponents<Option>
    >();
    expectTypeOf<
      (props: {option: Option; required: string}) => React.ReactNode
    >().not.toMatchTypeOf<ValueComponent>();
  });

  it('infers option objects for single, clearable, and multiple selections', () => {
    const single = (
      <Select
        options={options}
        value="apple"
        onChange={option => {
          expectTypeOf(option).toEqualTypeOf<(typeof options)[number]>();
        }}
      />
    );
    const clearable = (
      <Select
        clearable
        options={options}
        value={null}
        onChange={option => {
          expectTypeOf(option).toEqualTypeOf<(typeof options)[number] | null>();
        }}
      />
    );
    const multiple = (
      <Select
        multiple
        clearable
        options={options}
        value={['apple']}
        onChange={selected => {
          expectTypeOf(selected).toEqualTypeOf<typeof options>();
        }}
      />
    );

    void [single, clearable, multiple];
  });

  it('infers number and object values without changing the callback payload', () => {
    const number = (
      <Select
        options={[{value: 1, label: 'One'}]}
        value={1}
        onChange={option => {
          expectTypeOf(option.value).toEqualTypeOf<number>();
        }}
      />
    );
    const object = (
      <Select
        options={[{value: {id: 1}, label: 'One'}]}
        value={{id: 1}}
        isValueEqual={(a, b) => a.id === b.id}
        onChange={option => {
          expectTypeOf(option.value).toEqualTypeOf<{id: number}>();
        }}
      />
    );

    void [number, object];
  });

  it('rejects scalar multiple values and array single values, including defaults', () => {
    type Option = (typeof options)[number];
    expectTypeOf<{
      multiple: true;
      options: typeof options;
      value: string;
    }>().not.toMatchTypeOf<ControlProps<Option>>();
    expectTypeOf<{
      multiple: false;
      options: typeof options;
      value: string[];
    }>().not.toMatchTypeOf<ControlProps<Option>>();
    expectTypeOf<{
      defaultValue: string;
      multiple: true;
      options: typeof options;
    }>().not.toMatchTypeOf<ControlProps<Option>>();
    expectTypeOf<{
      defaultValue: string[];
      multiple: false;
      options: typeof options;
    }>().not.toMatchTypeOf<ControlProps<Option>>();
    expectTypeOf<{
      multiple: false;
      options: Array<{value: readonly string[]}>;
      value: readonly string[];
    }>().not.toMatchTypeOf<ControlProps<{value: readonly string[]}>>();
  });

  it('requires options and does not expose legacy choices', () => {
    type Option = (typeof options)[number];
    expectTypeOf<Omit<ControlProps<Option>, 'options'>>().not.toMatchTypeOf<
      ControlProps<Option>
    >();
    expectTypeOf<'choices'>().not.toMatchTypeOf<keyof ControlProps<Option>>();
    expectTypeOf<'indicator'>().not.toMatchTypeOf<keyof ControlProps<Option>>();
  });
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
    />
  );

  expect(screen.getByText('Selected Apple')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('textbox', {name: 'Fruit'}));
  await userEvent.click(screen.getByRole('menuitemradio', {name: 'Choose Cherry'}));

  expect(onChange).toHaveBeenCalledWith(options[1], expect.anything());
});

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
    />
  );

  expect(screen.getByText('Apple: Fruit')).toBeInTheDocument();
  await userEvent.click(screen.getAllByLabelText('Remove item')[0]!);

  expect(onChange).toHaveBeenCalledWith([options[1]], expect.anything());
});

it('customizes indicators while retaining the clear control', async () => {
  const onChange = jest.fn();
  render(
    <Select
      clearable
      options={options}
      value="apple"
      onChange={onChange}
      components={{Indicators: FruitIndicators}}
    />
  );

  expect(screen.getByText('Fruit indicators')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Clear choices'));
  expect(onChange).toHaveBeenCalledWith(null, expect.anything());
});

it('can hide indicators without disabling option selection', async () => {
  const onChange = jest.fn();
  render(
    <Select
      clearable
      aria-label="Fruit"
      options={options}
      value="apple"
      onChange={onChange}
      components={{Indicators: null}}
    />
  );

  expect(screen.queryByLabelText('Clear choices')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('textbox', {name: 'Fruit'}));
  await userEvent.click(screen.getByRole('menuitemradio', {name: 'Cherry'}));
  expect(onChange).toHaveBeenCalledWith(options[1], expect.anything());
});

it('provides a native input ref and forwards validation attributes', () => {
  const inputRef = createRef<HTMLInputElement>();
  const {unmount} = render(
    <Select
      aria-label="Fruit"
      aria-invalid
      aria-describedby="fruit-error"
      inputRef={inputRef}
      options={options}
    />
  );

  const input = screen.getByRole('textbox', {name: 'Fruit'});
  expect(inputRef.current).toBe(input);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAttribute('aria-describedby', 'fruit-error');

  unmount();
  expect(inputRef.current).toBeNull();
});

it('exposes focus and blur without access to the implementation instance', () => {
  const ref = createRef<SelectHandle>();
  render(<Select ref={ref} aria-label="Fruit" options={options} />);
  const input = screen.getByRole('textbox', {name: 'Fruit'});

  act(() => ref.current?.focus());
  expect(input).toHaveFocus();
  act(() => ref.current?.blur());
  expect(input).not.toHaveFocus();
});

function ControlledSelect({onOpenChange}: {onOpenChange: (open: boolean) => void}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Select
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
  render(<ControlledSelect onOpenChange={onOpenChange} />);

  await userEvent.click(screen.getByRole('textbox', {name: 'Fruit'}));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', {name: 'Manage fruit'})).toBeInTheDocument();
  for (const option of screen.getAllByRole('menuitemradio')) {
    expect(
      within(option).queryByRole('button', {name: 'Manage fruit'})
    ).not.toBeInTheDocument();
  }

  await userEvent.keyboard('{Escape}');
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('button', {name: 'Manage fruit'})).not.toBeInTheDocument();
});

it('uses raw values for the initial single and multiple selections', () => {
  render(
    <Fragment>
      <Select aria-label="Single fruit" options={options} defaultValue="apple" />
      <Select
        multiple
        aria-label="Multiple fruit"
        options={options}
        defaultValue={['cherry']}
      />
    </Fragment>
  );

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Cherry')).toBeInTheDocument();
});

it('blurs single selects after selection and reports edits and resets separately', async () => {
  const onInputChange = jest.fn();
  render(<Select aria-label="Fruit" options={options} onInputChange={onInputChange} />);
  const input = screen.getByRole('textbox', {name: 'Fruit'});

  await userEvent.type(input, 'App');
  expect(onInputChange).toHaveBeenLastCalledWith('App', 'input');
  expect(onInputChange).toHaveBeenCalledTimes(3);

  await userEvent.click(screen.getByRole('menuitemradio', {name: 'Apple'}));
  expect(input).not.toHaveFocus();
  expect(onInputChange).toHaveBeenLastCalledWith('', 'reset');
  expect(
    onInputChange.mock.calls.filter(([, reason]) => reason === 'input')
  ).toHaveLength(3);
});

it('keeps multiple selects focused after selection', async () => {
  render(<Select multiple aria-label="Fruit" options={options} />);
  const input = screen.getByRole('textbox', {name: 'Fruit'});

  await userEvent.click(input);
  await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Apple'}));

  expect(input).toHaveFocus();
  expect(screen.getByRole('menuitemcheckbox', {name: 'Cherry'})).toBeInTheDocument();
});

it('can retain focus in a single select without firing blur', async () => {
  const onBlur = jest.fn();
  render(
    <Select
      aria-label="Fruit"
      options={options}
      blurInputOnSelect={false}
      onBlur={onBlur}
    />
  );
  const input = screen.getByRole('textbox', {name: 'Fruit'});

  await userEvent.click(input);
  await userEvent.click(screen.getByRole('menuitemradio', {name: 'Apple'}));

  expect(input).toHaveFocus();
  expect(onBlur).not.toHaveBeenCalled();
});

it('filters numeric labels as text', async () => {
  render(<Select aria-label="Number" options={[{value: 'one', label: 123}]} />);

  await userEvent.type(screen.getByRole('textbox', {name: 'Number'}), '123');

  expect(screen.getByRole('menuitemradio', {name: '123'})).toBeInTheDocument();
});

it('preserves creatable defaults with an empty options list', () => {
  render(
    <Fragment>
      <Select<SelectValue<string>> creatable options={[]} defaultValue="New fruit" />
      <Select<SelectValue<string>>
        creatable
        multiple
        options={[]}
        defaultValue={['New tag']}
      />
    </Fragment>
  );

  expect(screen.getByText('New fruit')).toBeInTheDocument();
  expect(screen.getByText('New tag')).toBeInTheDocument();
});

it('passes option data directly to custom filters', async () => {
  render(
    <Select
      aria-label="Fruit"
      options={options}
      filterOption={option => option.value === 'cherry'}
    />
  );

  await userEvent.click(screen.getByRole('textbox', {name: 'Fruit'}));
  expect(screen.getByRole('menuitemradio', {name: 'Cherry'})).toBeInTheDocument();
  expect(screen.queryByRole('menuitemradio', {name: 'Apple'})).not.toBeInTheDocument();
});

it('owns the disabled row for an empty legacy selection', async () => {
  render(
    <Select
      aria-label="Fruit"
      options={options}
      value={null}
      emptyOptionLabel="None selected"
      placeholder="Choose fruit"
    />
  );

  expect(screen.getByText('Choose fruit')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('textbox', {name: 'Fruit'}));
  const emptyOption = screen.getByRole('menuitemradio', {name: 'None selected'});
  expect(emptyOption).toHaveAttribute('aria-disabled', 'true');
  expect(emptyOption).toBeChecked();
});
