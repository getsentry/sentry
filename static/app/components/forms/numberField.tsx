import InputField from './inputField';

type Props = InputField['props'];

export default function NumberField(props: Omit<Props, 'type'>) {
  return <InputField {...props} type="number" />;
}
