import type * as React from 'react';
import {useId} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useLabelId} from '@sentry/scraps/form/field/fieldIds';
import {GroupProvider, useGroupItemContext} from '@sentry/scraps/form/field/groupContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {BaseField, type BaseFieldProps} from './baseField';

export interface CheckboxGroupProps<
  T extends string,
> extends BaseFieldProps<HTMLDivElement> {
  children: (components: {
    Item: (props: CheckboxGroupItemProps<NoInfer<T>>) => React.JSX.Element;
  }) => React.ReactNode;
  onChange: (value: Array<NoInfer<T>>) => void;
  value: T[];
}

function CheckboxGroup({
  children,
  value,
  onChange,
  disabled,
  ref,
}: CheckboxGroupProps<string>) {
  const field = useFieldContext();
  const labelId = useLabelId();
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField disabled={disabled} ref={ref}>
      {({disabled: isDisabled, name, ...baseProps}, {indicator}) => (
        <GroupProvider
          value={{
            'aria-describedby': baseProps['aria-describedby'],
            'aria-invalid': baseProps['aria-invalid'],
            disabled: isDisabled,
            name,
            isChecked: itemValue => value.includes(itemValue),
            onChange: (itemValue, checked) => {
              onChange(
                checked ? [...value, itemValue] : value.filter(item => item !== itemValue)
              );
              if (autoSaveContext) {
                autoSaveContext.resetOnErrorRef.current = true;
                field.handleBlur();
              }
            },
          }}
        >
          <Stack
            {...baseProps}
            role="group"
            aria-labelledby={labelId}
            aria-disabled={isDisabled}
            flexGrow={1}
            tabIndex={-1}
            onFocus={event => {
              // Form errors and hash links focus the group through BaseField.
              // Move that focus to the first available control in the group.
              if (event.target === event.currentTarget) {
                event.currentTarget
                  .querySelector<HTMLInputElement>('input[type="checkbox"]:enabled')
                  ?.focus();
              }
            }}
          >
            {children(checkboxGroupComponents)}
          </Stack>
          {indicator}
        </GroupProvider>
      )}
    </BaseField>
  );
}

interface CheckboxGroupItemProps<T extends string> {
  children: React.ReactNode;
  value: T;
  disabled?: boolean;
}

function CheckboxGroupItem({
  children,
  value: itemValue,
  disabled,
}: CheckboxGroupItemProps<string>) {
  const {
    checked,
    onChange,
    disabled: groupDisabled,
    ...fieldProps
  } = useGroupItemContext(itemValue);
  const id = useId();

  return (
    <Flex as="label" gap="sm" align="center">
      <Checkbox
        {...fieldProps}
        id={id}
        value={itemValue}
        checked={checked}
        disabled={groupDisabled || disabled}
        onChange={event => onChange(itemValue, event.target.checked)}
      />
      <Text>{children}</Text>
    </Flex>
  );
}

const checkboxGroupComponents = {Item: CheckboxGroupItem};

// The callback ties the item values to the selected values' type. The runtime
// components stay shared so that rendering the callback does not remount items.
export const CheckboxGroupField = CheckboxGroup as <T extends string>(
  props: CheckboxGroupProps<T>
) => React.JSX.Element;
