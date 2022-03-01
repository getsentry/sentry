import InputField, {InputFieldProps} from './inputField';

export default function NumberField<P extends {}>(
  props: Omit<InputFieldProps<P>, 'type'>
) {
  return <InputField {...props} type="number" />;
}
