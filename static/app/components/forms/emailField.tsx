import type {InputFieldProps} from './inputField';
import InputField from './inputField';

export interface EmailFieldProps extends Omit<InputFieldProps, 'type'> {}

export default function EmailField(props: EmailFieldProps) {
  return <InputField {...props} type="email" />;
}
