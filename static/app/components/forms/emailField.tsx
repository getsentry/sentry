import InputField, {InputFieldProps} from './inputField';

export interface EmailFieldProps extends Omit<InputFieldProps, 'type'> {}

export default function EmailField(props: EmailFieldProps) {
  return <InputField {...props} type="email" />;
}
