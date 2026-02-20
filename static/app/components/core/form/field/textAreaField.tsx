import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {type TextAreaProps} from '@sentry/scraps/textarea';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

export function TextAreaField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<TextAreaProps, 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const textarea = (
          <InputGroup>
            <InputGroup.TextArea
              {...fieldProps}
              {...props}
              aria-disabled={isDisabled}
              readOnly={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
          </InputGroup>
        );

        if (disabledReason) {
          return (
            <Tooltip skipWrapper title={disabledReason}>
              {textarea}
            </Tooltip>
          );
        }

        return textarea;
      }}
    </BaseField>
  );
}
