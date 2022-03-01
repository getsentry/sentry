import * as React from 'react';
import omit from 'lodash/omit';

import Textarea from 'sentry/components/forms/controls/textarea';
import InputField, {InputFieldProps} from 'sentry/components/forms/inputField';

export interface TextareaFieldProps
  extends Omit<InputFieldProps<{}>, 'field'>,
    Pick<
      React.ComponentProps<typeof Textarea>,
      'monospace' | 'autosize' | 'rows' | 'maxRows'
    > {}

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
          {...omit(fieldProps, ['onKeyDown', 'children'])}
        />
      )}
    />
  );
}
