import InputField, {InputFieldProps} from 'sentry/components/forms/inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}
export default function TextField(props) {
  return <InputField {...props} type="text" />;
}
