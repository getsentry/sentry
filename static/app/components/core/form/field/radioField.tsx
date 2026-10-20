import {useId} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {useAutoSaveIndicator} from './baseField';
import {useLabelId} from './fieldIds';
import {GroupProvider, useGroupItemContext, type GroupContextValue} from './groupContext';
import {FieldMeta} from './meta';

// Radio.Group component
interface RadioGroupProps {
  children: React.ReactNode;
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean | string;
}

function RadioGroup({children, value, onChange, disabled}: RadioGroupProps) {
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
        {children}
        {indicator ?? (autoSaveContext ? <Flex width="14px" flexShrink={0} /> : null)}
        <FieldMeta.Status disabled={disabled} />
      </Flex>
    </GroupProvider>
  );
}

// Radio.Item component
interface RadioItemProps {
  children: React.ReactNode;
  value: string;
  description?: React.ReactNode;
}

function RadioItem({children, value, description}: RadioItemProps) {
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

// Export as namespace
export function RadioField() {
  return null;
}

RadioField.Group = RadioGroup;
RadioField.Item = RadioItem;
