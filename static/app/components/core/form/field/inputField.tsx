import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, type BaseFieldProps} from './baseField';

export function InputField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {(fieldProps, {indicator}) => {
        const input = (
          <InputGroup>
            <InputGroup.Input
              {...fieldProps}
              {...props}
              disabled={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
          </InputGroup>
        );

        if (disabledReason) {
          return (
            <Tooltip skipWrapper title={disabledReason}>
              {input}
            </Tooltip>
          );
        }

        return input;
      }}
    </BaseField>
  );
}
