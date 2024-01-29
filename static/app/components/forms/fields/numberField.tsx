import type {InputFieldProps} from './inputField';
import InputField from './inputField';

export interface NumberFieldProps extends Omit<InputFieldProps, 'type'> {}

function NumberField(props: NumberFieldProps) {
  return <InputField {...props} type="number" />;
}

export default NumberField;
