import React from 'react';
import omit from 'lodash/omit';

import InputField from './inputField';
import RadioBoolean from './controls/radioBoolean';

type Props = Omit<InputField['props'], 'field'>;

export default function RadioBooleanField(props: Props) {
  return (
    <InputField
      {...props}
      field={fieldProps => (
        <RadioBoolean {...omit(fieldProps, ['onKeyDown', 'children'])} />
      )}
    />
  );
}
