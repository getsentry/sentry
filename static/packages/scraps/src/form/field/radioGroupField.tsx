import type * as React from 'react';
import {useId} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useLabelId} from '@sentry/scraps/form/field/fieldIds';
import {
  GroupProvider,
  useGroupItemContext,
  type GroupContextValue,
} from '@sentry/scraps/form/field/groupContext';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {useAutoSaveIndicator} from './baseField';

export interface RadioGroupProps<T extends string> {
  children: (components: {
    Item: (props: RadioItemProps<NoInfer<T>>) => React.JSX.Element;
  }) => React.ReactNode;
  onChange: (value: NoInfer<T>) => void;
  value: T;
  disabled?: boolean | string;
}

function RadioGroup({children, value, onChange, disabled}: RadioGroupProps<string>) {
  const field = useFieldContext();
  const labelId = useLabelId();
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();

  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';

  const contextValue: GroupContextValue = {
    name: field.name,
    isChecked: itemValue => itemValue === value,
    onChange: (newValue: string) => {
      onChange(newValue);
      if (autoSaveContext) {
        // Radios should reset to previous value on error
        // oxlint-disable-next-line react/immutability
        autoSaveContext.resetOnErrorRef.current = true;
        field.handleBlur();
      }
    },
    onBlur: field.handleBlur,
    disabled: isDisabled,
    'aria-invalid': !field.state.meta.isValid,
  };

  return (
    <GroupProvider value={contextValue}>
      <Flex role="radiogroup" aria-labelledby={labelId} gap="sm" align="center">
        {children(radioGroupComponents)}
        {indicator ?? (autoSaveContext ? <Flex width="14px" flexShrink={0} /> : null)}
        <FieldMeta.Status disabled={disabled} />
      </Flex>
    </GroupProvider>
  );
}

interface RadioItemProps<T extends string> {
  children: React.ReactNode;
  value: T;
  description?: React.ReactNode;
}

function RadioItem({children, value, description}: RadioItemProps<string>) {
  const {checked, onChange, ...fieldProps} = useGroupItemContext(value);
  const descriptionId = useId();

  return (
    <Flex as="label" gap="sm" align="start" margin="0">
      <Radio
        {...fieldProps}
        aria-describedby={description ? descriptionId : undefined}
        value={value}
        checked={checked}
        onChange={() => onChange(value, true)}
      />
      <Stack gap="xs" paddingTop="xs">
        <Text bold={false}>{children}</Text>
        {description && (
          <Text bold={false} size="sm" variant="muted" id={descriptionId}>
            {description}
          </Text>
        )}
      </Stack>
    </Flex>
  );
}

const radioGroupComponents = {Item: RadioItem};

// The callback ties the item values to the selected value's type. The runtime
// components stay shared so that rendering the callback does not remount items.
export const RadioGroupField = RadioGroup as <T extends string>(
  props: RadioGroupProps<T>
) => React.JSX.Element;
