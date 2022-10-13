import InputField, {InputFieldProps} from './inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}

export default function TextField(props) {
  return <InputField {...props} type="text" />;
}
