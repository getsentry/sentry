import {forwardRef} from 'react';

import FormField from 'sentry/components/forms/formField';
import InputField, {InputFieldProps} from 'sentry/components/forms/inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}
const TextField = forwardRef<FormField, InputFieldProps>((props, ref) => {
  return <InputField formFieldForwardRef={ref} {...props} type="text" />;
});

export default TextField;
