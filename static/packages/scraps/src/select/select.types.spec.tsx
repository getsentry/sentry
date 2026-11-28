import type * as React from 'react';
import {Fragment} from 'react';
import {expectTypeOf} from 'expect-type';

import {
  FruitMultiValueLabel,
  FruitOptionLabel,
  FruitValue,
  options,
} from '../../test/selectFixtures';

import {createFilter} from './filter';
import {Select} from './select';
import type {ControlProps} from './select';
import type {SelectComponents, SelectValue, StylesConfig} from './types';

describe('selection types', () => {
  it('checks option types and required props for content components', () => {
    type Option = (typeof options)[number];
    type ValueComponent = NonNullable<SelectComponents<Option>['Value']>;
    type OptionLabel = NonNullable<SelectComponents<Option>['OptionLabel']>;
    type MultiValueLabel = NonNullable<SelectComponents<Option>['MultiValueLabel']>;

    expectTypeOf<typeof FruitValue>().toMatchTypeOf<ValueComponent>();
    expectTypeOf<typeof FruitOptionLabel>().toMatchTypeOf<OptionLabel>();
    expectTypeOf<typeof FruitMultiValueLabel>().toMatchTypeOf<MultiValueLabel>();
    expectTypeOf<
      (props: {option: SelectValue<number>}) => React.ReactNode
    >().not.toMatchTypeOf<ValueComponent>();
    expectTypeOf<
      (props: {option: SelectValue<number>}) => React.ReactNode
    >().not.toMatchTypeOf<OptionLabel>();
    expectTypeOf<
      (props: {children: React.ReactNode; option: SelectValue<number>}) => React.ReactNode
    >().not.toMatchTypeOf<MultiValueLabel>();
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

  it('allows disabled selects to omit onChange while retaining typed callbacks', () => {
    const single = <Select disabled options={options} value="apple" />;
    const clearable = <Select disabled clearable options={options} value={null} />;
    const multiple = <Select disabled multiple options={options} value={['apple']} />;

    const withCallbacks = (
      <Fragment>
        <Select
          disabled
          options={options}
          value="apple"
          onChange={option => {
            expectTypeOf(option).toEqualTypeOf<(typeof options)[number]>();
          }}
        />
        <Select
          disabled
          clearable
          options={options}
          value={null}
          onChange={option => {
            expectTypeOf(option).toEqualTypeOf<(typeof options)[number] | null>();
          }}
        />
        <Select
          disabled
          multiple
          options={options}
          value={[]}
          onChange={selected => {
            expectTypeOf(selected).toEqualTypeOf<typeof options>();
          }}
        />
      </Fragment>
    );

    void [single, clearable, multiple, withCallbacks];
  });

  it('requires onChange unless disabled is always true', () => {
    type Option = (typeof options)[number];
    expectTypeOf<{options: typeof options; value: string}>().not.toMatchTypeOf<
      ControlProps<string, Option>
    >();
    expectTypeOf<{
      disabled: false;
      options: typeof options;
      value: string;
    }>().not.toMatchTypeOf<ControlProps<string, Option>>();
    expectTypeOf<{
      disabled: boolean;
      options: typeof options;
      value: string;
    }>().not.toMatchTypeOf<ControlProps<string, Option>>();
    expectTypeOf<{disabled: true; options: typeof options}>().not.toMatchTypeOf<
      ControlProps<string, Option>
    >();
    expectTypeOf<{
      disabled: true;
      multiple: true;
      options: typeof options;
      value: string;
    }>().not.toMatchTypeOf<ControlProps<string, Option>>();
  });

  it('infers values and custom option data from options without a selected value', () => {
    const objectOptions = [{value: {id: 1}, label: 'One', searchKey: 'first'}];
    type TOption = (typeof objectOptions)[number];
    const styles: StylesConfig = {option: base => base};
    const select = (
      <Select
        value={null}
        options={objectOptions}
        styles={styles}
        isValueEqual={(a, b) => {
          expectTypeOf(a).toEqualTypeOf<{id: number}>();
          expectTypeOf(b).toEqualTypeOf<{id: number}>();
          return a.id === b.id;
        }}
        filterOption={option => {
          expectTypeOf(option).toEqualTypeOf<TOption>();
          return option.searchKey === 'first';
        }}
        components={{
          Value: ({option}) => {
            expectTypeOf(option).toEqualTypeOf<TOption>();
            return option.searchKey;
          },
          OptionLabel: ({option}) => {
            expectTypeOf(option).toEqualTypeOf<TOption>();
            return option.searchKey;
          },
        }}
        onChange={option => {
          expectTypeOf(option).toEqualTypeOf<TOption>();
        }}
      />
    );
    const clearable = (
      <Select
        clearable
        options={objectOptions}
        value={null}
        isValueEqual={(a, b) => {
          expectTypeOf(a).toEqualTypeOf<{id: number}>();
          expectTypeOf(b).toEqualTypeOf<{id: number}>();
          return a.id === b.id;
        }}
        onChange={option => {
          expectTypeOf(option).toEqualTypeOf<TOption | null>();
        }}
      />
    );

    void [select, clearable];
  });

  it('infers custom option data from readonly groups with an empty selection', () => {
    const groupedOptions = [{label: 'Fruit', options}] as const;
    const select = (
      <Select
        multiple
        options={groupedOptions}
        value={[]}
        components={{
          MultiValueLabel: ({option}) => {
            expectTypeOf(option).toEqualTypeOf<(typeof options)[number]>();
            return option.details;
          },
        }}
        styles={{
          option: (base, {data}) => {
            expectTypeOf(data).toEqualTypeOf<(typeof options)[number]>();
            return base;
          },
        }}
        onChange={selected => {
          expectTypeOf(selected).toEqualTypeOf<typeof options>();
        }}
      />
    );

    void select;
  });

  it('preserves custom option data in filters and style overrides', () => {
    type TOption = SelectValue<number> & {searchKey: string};
    const filter = createFilter({stringify: (option: TOption) => option.searchKey});
    expectTypeOf(filter).toEqualTypeOf<(option: TOption, input: string) => boolean>();
    const styles: StylesConfig<number, TOption> = {
      option: (base, {data}) => {
        expectTypeOf(data).toEqualTypeOf<TOption>();
        return base;
      },
    };

    void styles;
  });

  it('rejects scalar multiple values and array single values', () => {
    type Option = (typeof options)[number];
    expectTypeOf<{
      multiple: true;
      onChange: (options: Option[]) => void;
      options: typeof options;
      value: string;
    }>().not.toMatchTypeOf<ControlProps<string, Option>>();
    expectTypeOf<{
      multiple: false;
      onChange: (option: Option) => void;
      options: typeof options;
      value: string[];
    }>().not.toMatchTypeOf<ControlProps<string, Option>>();
    expectTypeOf<{
      multiple: false;
      onChange: (option: SelectValue<readonly string[]>) => void;
      options: Array<{value: readonly string[]}>;
      value: readonly string[];
    }>().not.toMatchTypeOf<ControlProps<readonly string[]>>();
  });

  it('requires controlled selection and options without exposing defaults or choices', () => {
    type Option = (typeof options)[number];
    expectTypeOf<Omit<ControlProps<string, Option>, 'options'>>().not.toMatchTypeOf<
      ControlProps<string, Option>
    >();
    expectTypeOf<Omit<ControlProps<string, Option>, 'value'>>().not.toMatchTypeOf<
      ControlProps<string, Option>
    >();
    expectTypeOf<Omit<ControlProps<string, Option>, 'onChange'>>().not.toMatchTypeOf<
      ControlProps<string, Option>
    >();
    expectTypeOf<'defaultValue'>().not.toMatchTypeOf<
      keyof ControlProps<string, Option>
    >();
    expectTypeOf<'choices'>().not.toMatchTypeOf<keyof ControlProps<string, Option>>();
    expectTypeOf<
      Extract<
        keyof ControlProps<string, Option>,
        'emptyOptionLabel' | 'inFieldLabel' | 'optionHeight'
      >
    >().toBeNever();
    expectTypeOf<'indicator'>().not.toMatchTypeOf<keyof ControlProps<string, Option>>();
  });
});
