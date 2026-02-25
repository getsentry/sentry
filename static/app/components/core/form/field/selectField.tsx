import {useRef, type Ref} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {SelectValue} from 'sentry/types/core';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

function SelectInput({
  selectProps,
  ...props
}: React.ComponentProps<typeof components.Input> & {
  selectProps: {'aria-invalid': boolean; inputRef: Ref<{input: HTMLInputElement}>};
}) {
  return (
    <components.Input
      {...props}
      {...{ref: selectProps.inputRef}}
      aria-invalid={selectProps['aria-invalid']}
    />
  );
}

function SelectIndicatorsContainer({
  children,
}: React.ComponentProps<typeof components.IndicatorsContainer>) {
  const indicator = useFieldStateIndicator();
  return (
    <Flex padding="0 sm" gap="sm" align="center">
      {indicator}
      {children}
    </Flex>
  );
}

// Base props shared by all select variants
type BaseSelectFieldProps = BaseFieldProps &
  Omit<
    React.ComponentProps<typeof Select>,
    | 'value'
    | 'onChange'
    | 'onBlur'
    | 'disabled'
    | 'multiple'
    | 'multi'
    | 'clearable'
    | 'id'
  > & {
    disabled?: boolean | string;
  };

// Helper type for non-array constraint
type NonArray<T> = T extends readonly unknown[] ? never : T;

// Single select WITHOUT clearable - onChange receives TValue (never null)
interface SingleUnclearableSelectFieldProps<TValue> extends BaseSelectFieldProps {
  onChange: (value: NonArray<TValue>) => void;
  value: NonArray<TValue> | null;
  clearable?: false;
  multiple?: false;
}

// Single select WITH clearable - onChange can receive TValue | null
interface SingleClearableSelectFieldProps<TValue> extends BaseSelectFieldProps {
  clearable: true;
  onChange: (value: NonArray<TValue> | null) => void;
  value: NonArray<TValue> | null;
  multiple?: false;
}

// Multiple select - TValue must be an array
interface MultipleSelectFieldProps<TValue> extends BaseSelectFieldProps {
  multiple: true;
  onChange: (value: TValue extends readonly unknown[] ? TValue : never) => void;
  value: TValue extends readonly unknown[] ? TValue : never;
  clearable?: boolean;
}

export type SelectFieldProps<TValue = string> =
  | SingleUnclearableSelectFieldProps<TValue>
  | SingleClearableSelectFieldProps<TValue>
  | MultipleSelectFieldProps<TValue>;

// HACK: react-select types are bad, ref is a custom StateManager
// This converts the `ref` value of SelectInput into a format
// that works for BaseField, which expects `fieldProps.ref: Ref<HTMLElement>`
const applyInputToRef =
  (ref: Ref<HTMLElement>) =>
  (instance: null | {input: HTMLInputElement}): void => {
    if (instance) {
      if (typeof ref === 'function') {
        ref(instance.input);
      } else if (ref) {
        ref.current = instance.input;
      }
    }
  };

export function SelectField<TValue = string>({
  onChange,
  disabled,
  multiple,
  value,
  ...props
}: SelectFieldProps<TValue>) {
  const autoSaveContext = useAutoSaveContext();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  // Track whether the menu is open for multi-select auto-save behavior
  const isMenuOpenRef = useRef(false);

  return (
    <BaseField>
      {({id, ref, ...fieldProps}) => {
        const select = (
          <Select
            {...fieldProps}
            {...props}
            inputId={id}
            disabled={isDisabled}
            multiple={multiple}
            value={value}
            inputRef={applyInputToRef(ref)}
            components={{
              ...props.components,
              Input: SelectInput,
              IndicatorsContainer: SelectIndicatorsContainer,
            }}
            onMenuOpen={() => {
              isMenuOpenRef.current = true;
              props.onMenuOpen?.();
            }}
            onMenuClose={() => {
              isMenuOpenRef.current = false;
              props.onMenuClose?.();
              // For multi-select in auto-save context, trigger save when menu closes
              if (multiple && autoSaveContext) {
                fieldProps.onBlur();
              }
            }}
            onChange={(
              option: SelectValue<TValue> | Array<SelectValue<TValue>> | null
            ) => {
              if (multiple) {
                // For multi-select, option is an array
                (onChange as (value: TValue[]) => void)(
                  Array.isArray(option) ? option.map(o => o.value) : []
                );
                // For multi-select in auto-save context, trigger save when menu is closed
                // (e.g., clicking X on a tag or clear all while menu is not open)
                if (autoSaveContext && !isMenuOpenRef.current) {
                  fieldProps.onBlur();
                }
              } else {
                if (!option) {
                  // Clearable single select - type system allows null via discriminated union
                  (onChange as (value: TValue | null) => void)(null);
                  return;
                }
                // For single-select, option is a single value
                (onChange as (value: TValue) => void)(
                  (option as SelectValue<TValue>).value
                );
              }
            }}
          />
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{select}</Tooltip>;
        }

        return select;
      }}
    </BaseField>
  );
}
