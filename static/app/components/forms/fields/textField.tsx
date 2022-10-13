import InputField, {InputFieldProps} from 'sentry/components/forms/fields/inputField';

export interface TextFieldProps extends Omit<InputFieldProps, 'type'> {}
export default function TextField(props) {
  return <InputField {...props} type="text" />;
}
