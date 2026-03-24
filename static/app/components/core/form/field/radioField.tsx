import {createContext, useContext, useId} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {useAutoSaveIndicator, useLabelId} from './baseField';
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
    'aria-invalid': !field.state.meta.isValid,
  };

  return (
    <GroupProvider>
      <RadioContext value={contextValue}>
        <Flex role="radiogroup" aria-labelledby={labelId} gap="sm" align="center">
          {children}
          {indicator ?? <Flex width="14px" flexShrink={0} />}
          <FieldMeta.Status disabled={disabled} />
        </Flex>
      </RadioContext>
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
      <Flex direction="column" gap="xs" paddingTop="xs">
        <Text>{children}</Text>
        {description && (
          <Text size="sm" variant="muted" id={descriptionId}>
            {description}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}

// Export as namespace
export function RadioField() {
  return null;
}

RadioField.Group = RadioGroup;
RadioField.Item = RadioItem;
