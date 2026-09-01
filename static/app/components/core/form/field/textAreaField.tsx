import type {AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {type TextAreaProps} from '@sentry/scraps/textarea';

import {BaseFieldImpl, type BaseFieldProps} from './baseField';

export function TextAreaField({
  field,
  onChange,
  disabled,
  ref,
  ...props
}: BaseFieldProps<HTMLTextAreaElement> & {field: AnyFieldApi} & Omit<
    TextAreaProps,
    'value' | 'onChange' | 'onBlur' | 'disabled'
  > & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
  }) {
  return (
    <BaseFieldImpl field={field} disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <InputGroup style={{flex: 1}}>
          <InputGroup.TextArea
            {...fieldProps}
            {...props}
            onChange={e => onChange(e.target.value)}
          />
          <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
        </InputGroup>
      )}
    </BaseFieldImpl>
  );
}
