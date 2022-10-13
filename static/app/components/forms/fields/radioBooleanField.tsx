import omit from 'lodash/omit';

import RadioBoolean from 'sentry/components/forms/controls/radioBoolean';

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
