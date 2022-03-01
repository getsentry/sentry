import InputField, {InputFieldProps} from 'sentry/components/forms/inputField';

export default function TextField(props: Omit<InputFieldProps<{}>, 'type'>) {
  return <InputField {...props} type="text" />;
}
