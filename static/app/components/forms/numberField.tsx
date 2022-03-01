import InputField, {InputFieldProps} from './inputField';

export default function NumberField(props: Omit<InputFieldProps<{}>, 'type'>) {
  return <InputField {...props} type="number" />;
}
