import {createContext, useContext} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useFieldStateIndicator} from './baseField';

// Context for Radio.Group -> Radio.Item communication
interface RadioContextValue {
  ariaInvalid: boolean;
  disabled: boolean;
  name: string;
  onChange: (value: string) => void;
  value: string;
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
  orientation?: 'vertical' | 'horizontal';
}

function RadioGroup({
  children,
  value,
  onChange,
  disabled,
  orientation = 'vertical',
}: RadioGroupProps) {
  const field = useFieldContext();
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();

  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;

  const contextValue: RadioContextValue = {
    name: field.name,
    value,
    onChange: (newValue: string) => {
      onChange(newValue);
      if (autoSaveContext) {
        field.handleBlur();
      }
    },
    disabled: isDisabled,
    ariaInvalid: hasError,
  };

  const content = (
    <Flex gap="md" align="center">
      <Flex
        role="radiogroup"
        direction={orientation === 'horizontal' ? 'row' : 'column'}
        gap="md"
        align={orientation === 'horizontal' ? 'center' : 'start'}
      >
        <RadioContext.Provider value={contextValue}>{children}</RadioContext.Provider>
      </Flex>
      {indicator}
    </Flex>
  );

  if (disabledReason) {
    return <Tooltip title={disabledReason}>{content}</Tooltip>;
  }

  return content;
}

// Radio.Item component
interface RadioItemProps {
  children: React.ReactNode;
  value: string;
  description?: React.ReactNode;
}

function RadioItem({children, value, description}: RadioItemProps) {
  const {name, value: selectedValue, onChange, disabled, ariaInvalid} = useRadioContext();

  return (
    <Flex as="label" gap="sm" align="start">
      <Radio
        name={name}
        value={value}
        checked={selectedValue === value}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        onChange={() => onChange(value)}
      />
      <Flex direction="column" gap="xs" paddingTop="xs">
        <Text>{children}</Text>
        {description && (
          <Text size="sm" variant="muted">
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
