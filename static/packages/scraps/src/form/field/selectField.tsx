import {Fragment, useRef} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Container} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import type {
  BaseSelectProps,
  SelectSelectionProps,
  SelectValue,
} from '@sentry/scraps/select';

import {BaseField, type BaseFieldProps} from './baseField';

// Base props shared by all select variants
type BaseSelectFieldProps<TValue, TOption extends SelectValue<TValue>> = Omit<
  BaseSelectProps<TValue, TOption, SelectValue<TValue | string>>,
  'onBlur' | 'disabled' | 'ref' | 'inputRef' | 'id' | 'options'
> &
  BaseFieldProps<HTMLInputElement> & {
    options: ReadonlyArray<TOption & SelectValue<TValue>>;
  };

export type SelectFieldProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
> = BaseSelectFieldProps<TValue, TOption> & SelectSelectionProps<TValue>;

export function SelectField<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>({
  onChange,
  disabled,
  multiple,
  clearable,
  trailingItems,
  value,
  ref,
  ...props
}: SelectFieldProps<TValue, TOption>) {
  const autoSaveContext = useAutoSaveContext();
  // The field API still dispatches raw values, including strings entered in creatable selects.
  const changeValue = onChange as (
    value: TValue | string | Array<TValue | string> | null
  ) => void;
  const selectVariantProps = multiple
    ? {multiple: true as const, clearable, value}
    : clearable
      ? {clearable: true as const, value}
      : {value};

  // Track whether the menu is open for multi-select auto-save behavior
  const isMenuOpenRef = useRef(false);

  return (
    <BaseField disabled={disabled} ref={ref}>
      {({id, ref: fieldRef, ...fieldProps}, {indicator}) => (
        <Container flex={1} minWidth={0}>
          <Select
            {...fieldProps}
            {...props}
            {...selectVariantProps}
            creatable={props.creatable}
            id={id}
            inputRef={fieldRef}
            blurInputOnSelect={false}
            trailingItems={
              <Fragment>
                {indicator}
                {trailingItems}
              </Fragment>
            }
            onOpenChange={isOpen => {
              isMenuOpenRef.current = isOpen;
              props.onOpenChange?.(isOpen);
              if (!isOpen && multiple && autoSaveContext) {
                fieldProps.onBlur();
              }
            }}
            onChange={(
              option:
                | SelectValue<TValue | string>
                | Array<SelectValue<TValue | string>>
                | null
            ) => {
              if (multiple) {
                // For multi-select, option is an array
                changeValue(Array.isArray(option) ? option.map(o => o.value) : []);
                // For multi-select in auto-save context, trigger save when menu is closed
                // (e.g., clicking X on a tag or clear all while menu is not open)
                if (autoSaveContext && !isMenuOpenRef.current) {
                  fieldProps.onBlur();
                }
              } else {
                if (!option) {
                  changeValue(null);
                  if (autoSaveContext) {
                    fieldProps.onBlur();
                  }
                  return;
                }
                // For single-select, option is a single value
                if (!Array.isArray(option)) {
                  changeValue(option.value);
                }
                // Preserve blur validation and auto-save after selection.
                fieldProps.onBlur();
              }
            }}
          />
        </Container>
      )}
    </BaseField>
  );
}
