import omit from 'lodash/omit';

import Textarea, {TextAreaProps} from 'sentry/components/forms/controls/textarea';
import FormField from 'sentry/components/forms/formField';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

export interface TextareaFieldProps
  extends Omit<InputFieldProps, 'field'>,
    Pick<TextAreaProps, 'monospace' | 'autosize' | 'rows' | 'maxRows'> {}

function TextareaField({monospace, rows, autosize, ...props}: TextareaFieldProps) {
  return (
    <FormField {...props}>
      {({children: _children, ...fieldProps}) => (
        <Textarea
          {...{monospace, rows, autosize}}
          // Do not forward required to `textarea` to avoid default browser behavior
          {...omit(fieldProps, ['onKeyDown', 'children', 'required'])}
        />
      )}
    </FormField>
  );
}

export default TextareaField;
