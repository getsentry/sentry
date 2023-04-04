import InputField, {InputFieldProps} from './inputField';

export type DateTimeFieldProps = Omit<InputFieldProps, 'type'>;

const DateTimeField = (props: DateTimeFieldProps) => {
  return <InputField {...props} type="datetime-local" />;
};

export default DateTimeField;
