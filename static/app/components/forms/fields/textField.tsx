import type {InputFieldProps} from './inputField';
import InputField from './inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}

function TextField(props: TextFieldProps) {
  return <InputField {...props} type="text" />;
}

export default TextField;
