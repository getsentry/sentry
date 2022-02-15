import InputField from 'sentry/components/forms/inputField';

type Props = InputField['props'];

export default function TextField(props: Omit<Props, 'type'>) {
  return <InputField {...props} type="text" />;
}
