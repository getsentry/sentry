import omit from 'lodash/omit';

import RadioBoolean from './controls/radioBoolean';
import InputField, {InputFieldProps} from './inputField';

export default function RadioBooleanField(props: Omit<InputFieldProps, 'field'>) {
  return (
    <InputField
      {...props}
      field={fieldProps => (
        <RadioBoolean {...omit(fieldProps, ['onKeyDown', 'children'])} />
      )}
    />
  );
}
