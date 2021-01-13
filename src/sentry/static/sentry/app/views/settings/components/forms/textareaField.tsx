import React from 'react';
import omit from 'lodash/omit';

import Textarea from 'app/views/settings/components/forms/controls/textarea';
import InputField from 'app/views/settings/components/forms/inputField';

type Props = Omit<InputField['props'], 'field'> &
  Pick<React.ComponentProps<typeof Textarea>, 'monospace' | 'autosize' | 'rows'>;

export default function TextareaField({monospace, rows, autosize, ...props}: Props) {
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
