import InputField, {InputFieldProps} from './inputField';

export default function DateTimeField<P extends {}>(
  props: Omit<InputFieldProps<P>, 'type'>
) {
  return <InputField {...props} type="datetime-local" />;
}
