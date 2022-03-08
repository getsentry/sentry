import InputField, {InputFieldProps} from './inputField';

export default function DateTimeField(props: Omit<InputFieldProps, 'type'>) {
  return <InputField {...props} type="datetime-local" />;
}
