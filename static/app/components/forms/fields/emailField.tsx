import InputField, {InputFieldProps} from './inputField';

export interface EmailFieldProps extends Omit<InputFieldProps, 'type'> {}

function EmailField(props: EmailFieldProps) {
  return <InputField {...props} type="email" />;
}

export default EmailField;
