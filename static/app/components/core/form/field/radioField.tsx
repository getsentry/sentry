import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

interface RadioOption {
  label: React.ReactNode;
  value: string;
  description?: React.ReactNode;
}

export function RadioField({
  onChange,
  disabled,
  options,
  value,
  orientation = 'vertical',
  ...props
}: BaseFieldProps & {
  onChange: (value: string) => void;
  options: RadioOption[];
  value: string;
  disabled?: boolean | string;
  orientation?: 'vertical' | 'horizontal';
}) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const radioGroup = (
          <Flex
            gap="md"
            direction={orientation === 'horizontal' ? 'row' : 'column'}
            align={orientation === 'horizontal' ? 'center' : 'start'}
            role="radiogroup"
            aria-labelledby={fieldProps.id}
          >
            {options.map(option => (
              <Flex key={option.value} as="label" gap="sm" align="start">
                <Radio
                  {...props}
                  name={fieldProps.name}
                  value={option.value}
                  checked={value === option.value}
                  disabled={isDisabled}
                  aria-invalid={fieldProps['aria-invalid']}
                  onChange={() => {
                    onChange(option.value);
                    if (autoSaveContext) {
                      fieldProps.onBlur();
                    }
                  }}
                />
                <Flex direction="column" gap="xs">
                  <span>{option.label}</span>
                  {option.description && (
                    <Text size="sm" variant="muted">
                      {option.description}
                    </Text>
                  )}
                </Flex>
              </Flex>
            ))}
            {indicator}
          </Flex>
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{radioGroup}</Tooltip>;
        }

        return radioGroup;
      }}
    </BaseField>
  );
}
