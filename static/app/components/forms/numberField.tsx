import InputField, {InputFieldProps} from './inputField';

export interface NumberFieldProps extends Omit<InputFieldProps, 'type'> {}
export default function NumberField(props) {
  return <InputField {...props} type="number" />;
}
