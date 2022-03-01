import InputField, {InputFieldProps} from './inputField';

export default function EmailField(props: Omit<InputFieldProps<{}>, 'type'>) {
  return <InputField {...props} type="email" />;
}
