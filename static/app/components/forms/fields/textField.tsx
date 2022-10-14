import InputField, {InputFieldProps} from './inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}

function TextField(props: TextFieldProps) {
  return <InputField {...props} type="text" />;
}

export default TextField;
