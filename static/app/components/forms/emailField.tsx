import InputField, {InputFieldProps} from './inputField';

export default function EmailField<P extends {} = {}>(
  props: Omit<InputFieldProps<P>, 'type'>
) {
  return <InputField {...props} type="email" />;
}
