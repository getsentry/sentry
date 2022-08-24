import type {InputFieldProps} from './inputField';
import InputField from './inputField';

export interface NumberFieldProps extends Omit<InputFieldProps, 'type'> {}

export default function NumberField(props) {
  return <InputField {...props} type="number" />;
}
