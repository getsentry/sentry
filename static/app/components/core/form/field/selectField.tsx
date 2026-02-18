import {useRef} from 'react';

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
  selectProps: {'aria-invalid': boolean};
}) {
  return <components.Input {...props} aria-invalid={selectProps['aria-invalid']} />;
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

// Base props shared by both single and multiple select
type BaseSelectFieldProps = BaseFieldProps &
  Omit<
    React.ComponentProps<typeof Select>,
    'value' | 'onChange' | 'onBlur' | 'disabled' | 'multiple' | 'multi'
  > & {
    disabled?: boolean | string;
  };

// Single select (default) - TValue must NOT be an array
interface SingleSelectFieldProps<TValue> extends BaseSelectFieldProps {
  onChange: (value: TValue extends readonly unknown[] ? never : TValue) => void;
  value: TValue extends readonly unknown[] ? never : TValue | null;
  multiple?: false;
}

// Multiple select - TValue must be an array
interface MultipleSelectFieldProps<TValue> extends BaseSelectFieldProps {
  multiple: true;
  onChange: (value: TValue extends readonly unknown[] ? TValue : never) => void;
  value: TValue extends readonly unknown[] ? TValue : never;
}

export type SelectFieldProps<TValue = string> =
  | SingleSelectFieldProps<TValue>
  | MultipleSelectFieldProps<TValue>;

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
      {({id, ...fieldProps}) => {
        const select = (
          <Select
            {...fieldProps}
            {...props}
            inputId={id}
            disabled={isDisabled}
            multiple={multiple}
            value={value}
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
                  // todo single-select with clearable needs to be able to allow null as value
                  onChange(null as any);
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
