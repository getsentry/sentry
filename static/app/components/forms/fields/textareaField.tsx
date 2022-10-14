import omit from 'lodash/omit';

import Textarea, {TextAreaProps} from 'sentry/components/forms/controls/textarea';

import InputField, {InputFieldProps} from './inputField';

export interface TextareaFieldProps
  extends Omit<InputFieldProps, 'field'>,
    Pick<TextAreaProps, 'monospace' | 'autosize' | 'rows' | 'maxRows'> {}

function TextareaField({monospace, rows, autosize, ...props}: TextareaFieldProps) {
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

export default TextareaField;
