import InputField, {InputFieldProps} from './inputField';

export type DateTimeFieldProps = Omit<InputFieldProps, 'type'>;

export default function DateTimeField(props: DateTimeFieldProps) {
  return <InputField {...props} type="datetime-local" />;
}
