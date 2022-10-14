import InputField, {InputFieldProps} from './inputField';

export interface SecretFieldProps extends Omit<InputFieldProps, 'type'> {}

function SecretField(props: SecretFieldProps) {
  return <InputField {...props} type="password" />;
}

export default SecretField;
