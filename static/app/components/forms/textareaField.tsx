import omit from 'lodash/omit';

import type {TextAreaProps} from 'sentry/components/forms/controls/textarea';
import Textarea from 'sentry/components/forms/controls/textarea';
import type {InputFieldProps} from 'sentry/components/forms/inputField';
import InputField from 'sentry/components/forms/inputField';

export interface TextareaFieldProps
  extends Omit<InputFieldProps, 'field'>,
    Pick<TextAreaProps, 'monospace' | 'autosize' | 'rows' | 'maxRows'> {}

export default function TextareaField({
  monospace,
  rows,
  autosize,
  ...props
}: TextareaFieldProps) {
  return (
    <InputField
      {...props}
      field={fieldProps => (
        <Textarea
          {...{monospace, rows, autosize}}
          // Do not forward required to `textarea` to avoid default browser behavior
          {...omit(fieldProps, ['onKeyDown', 'children', 'required'])}
        />
      )}
    />
  );
}
