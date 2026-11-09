import {useRef} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/formPresentation';
import {Container, Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import type {
  BaseSelectProps,
  SelectComponents,
  SelectSelectionProps,
  SelectValue,
} from '@sentry/scraps/select';

import {BaseField, useAutoSaveIndicator, type BaseFieldProps} from './baseField';

function SelectIndicatorsContainer({children}: {children: React.ReactNode}) {
  const indicator = useAutoSaveIndicator();
  return (
    <Flex padding="0 sm" gap="sm" align="center">
      {indicator}
      {children}
    </Flex>
  );
}

// Base props shared by all select variants
type BaseSelectFieldProps<TValue, TOption extends SelectValue<TValue>> = Omit<
  BaseSelectProps<TValue, TOption>,
  'onBlur' | 'disabled' | 'ref' | 'inputRef' | 'components' | 'id' | 'options'
> &
  BaseFieldProps<HTMLInputElement> & {
    options: ReadonlyArray<TOption & SelectValue<TValue>>;
    components?: Omit<SelectComponents<TOption>, 'Indicators'>;
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
  value,
  ref,
  ...props
}: SelectFieldProps<TValue, TOption>) {
  const autoSaveContext = useAutoSaveContext();
  const selectVariantProps = multiple
    ? {multiple: true as const, clearable, value}
    : clearable
      ? {clearable: true as const, value}
      : {value};

  // Track whether the menu is open for multi-select auto-save behavior
  const isMenuOpenRef = useRef(false);

  return (
    <BaseField disabled={disabled} ref={ref}>
      {({id, ref: fieldRef, ...fieldProps}) => (
        <Container flex={1} minWidth={0}>
          <Select
            {...fieldProps}
            {...props}
            {...selectVariantProps}
            id={id}
            inputRef={fieldRef}
            blurInputOnSelect={false}
            components={{...props.components, Indicators: SelectIndicatorsContainer}}
            onOpenChange={isOpen => {
              isMenuOpenRef.current = isOpen;
              props.onOpenChange?.(isOpen);
              if (!isOpen && multiple && autoSaveContext) {
                fieldProps.onBlur();
              }
            }}
            onChange={(option: TOption | TOption[] | null) => {
              if (multiple) {
                // For multi-select, option is an array
                onChange(Array.isArray(option) ? option.map(o => o.value) : []);
                // For multi-select in auto-save context, trigger save when menu is closed
                // (e.g., clicking X on a tag or clear all while menu is not open)
                if (autoSaveContext && !isMenuOpenRef.current) {
                  fieldProps.onBlur();
                }
              } else {
                if (!option) {
                  // Clearable single select - type system allows null via discriminated union
                  (onChange as (value: TValue | null) => void)(null);
                  if (autoSaveContext) {
                    fieldProps.onBlur();
                  }
                  return;
                }
                // For single-select, option is a single value
                (onChange as (value: TValue) => void)((option as TOption).value);
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
