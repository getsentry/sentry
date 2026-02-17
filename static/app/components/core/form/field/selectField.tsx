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

// Single select (default)
interface SingleSelectFieldProps extends BaseSelectFieldProps {
  onChange: (value: string) => void;
  value: string;
  multiple?: false;
}

// Multiple select
interface MultipleSelectFieldProps extends BaseSelectFieldProps {
  multiple: true;
  onChange: (value: string[]) => void;
  value: string[];
}

type SelectFieldProps = SingleSelectFieldProps | MultipleSelectFieldProps;

export function SelectField({
  onChange,
  disabled,
  multiple,
  value,
  ...props
}: SelectFieldProps) {
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
            onChange={(option: SelectValue<string> | Array<SelectValue<string>>) => {
              if (multiple) {
                // For multi-select, option is an array
                const values = Array.isArray(option)
                  ? option.map(o => o?.value ?? '').filter(Boolean)
                  : [];
                (onChange as (value: string[]) => void)(values);
                // For multi-select in auto-save context, trigger save when menu is closed
                // (e.g., clicking X on a tag or clear all while menu is not open)
                if (autoSaveContext && !isMenuOpenRef.current) {
                  fieldProps.onBlur();
                }
              } else {
                // For single-select, option is a single value
                const val = (option as SelectValue<string>)?.value ?? '';
                (onChange as (value: string) => void)(val);
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
