import InputField, {InputFieldProps} from './inputField';

export type DateTimeFieldProps = Omit<InputFieldProps, 'type'>;

function DateTimeField(props: DateTimeFieldProps) {
  return <InputField {...props} type="datetime-local" />;
}

export default DateTimeField;
