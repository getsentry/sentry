import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

export function InputField({
  onChange,
  disabled,
  trailingAction,
  ...props
}: BaseFieldProps &
  Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
    trailingAction?: React.ReactNode;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const input = (
          <InputGroup>
            <InputGroup.Input
              {...fieldProps}
              {...props}
              aria-disabled={isDisabled}
              readOnly={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>
              {trailingAction}
              {indicator}
            </InputGroup.TrailingItems>
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
