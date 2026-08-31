import {createContext, useContext, useId} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {fieldComponent, type AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {getLabelId, useAutoSaveIndicator} from './baseField';
import {GroupProvider} from './groupContext';
import {FieldMeta} from './meta';

// Context for Radio.Group -> Radio.Item communication
interface RadioContextValue {
  'aria-invalid': boolean;
  disabled: boolean;
  name: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  selectedValue: string;
}

const RadioContext = createContext<RadioContextValue | null>(null);

function useRadioContext() {
  const ctx = useContext(RadioContext);
  if (!ctx) {
    throw new Error('Radio.Item must be used within Radio.Group');
  }
  return ctx;
}

// Radio.Group component
interface RadioGroupProps {
  children: React.ReactNode;
  field: AnyFieldApi;
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean | string;
}

function RadioGroup({children, value, onChange, disabled, field}: RadioGroupProps) {
  const labelId = getLabelId(field);
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator(field);

  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';

  const contextValue: RadioContextValue = {
    name: field.name,
    selectedValue: value,
    onChange: (newValue: string) => {
      onChange(newValue);
      if (autoSaveContext) {
        // Radios should reset to previous value on error
        autoSaveContext.resetOnErrorRef.current = true;
        field.handleBlur();
      }
    },
    onBlur: field.handleBlur,
    disabled: isDisabled,
    'aria-invalid': !field.meta.isValid,
  };

  return (
    <GroupProvider>
      <RadioContext value={contextValue}>
        <Flex role="radiogroup" aria-labelledby={labelId} gap="sm" align="center">
          {children}
          {indicator ?? (autoSaveContext ? <Flex width="14px" flexShrink={0} /> : null)}
          <FieldMeta.Status disabled={disabled} />
        </Flex>
      </RadioContext>
    </GroupProvider>
  );
}

// Radio.Item component
interface RadioItemProps {
  children: React.ReactNode;
  field: AnyFieldApi;
  value: string;
  description?: React.ReactNode;
}

function RadioItem({children, value, description}: RadioItemProps) {
  const {selectedValue, onChange, ...fieldProps} = useRadioContext();
  const descriptionId = useId();

  return (
    <Flex as="label" gap="sm" align="start" margin="0">
      <Radio
        {...fieldProps}
        aria-describedby={description ? descriptionId : undefined}
        value={value}
        checked={selectedValue === value}
        onChange={() => onChange(value)}
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

RadioField.Group = fieldComponent.loose(RadioGroup, 'field');
RadioField.Item = fieldComponent.loose(RadioItem, 'field');
