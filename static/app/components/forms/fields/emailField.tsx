import InputField, {InputFieldProps} from './inputField';

export interface EmailFieldProps extends Omit<InputFieldProps, 'type'> {}

const EmailField = (props: EmailFieldProps) => {
  return <InputField {...props} type="email" />;
};

export default EmailField;
