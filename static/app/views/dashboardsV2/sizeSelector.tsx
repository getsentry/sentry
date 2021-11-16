import {SelectField} from 'app/components/forms';

type Props = {
  size: string;
  onSizeChange: (size: string) => void;
};

const SizeSelector = ({size, onSizeChange}: Props) => {
  return (
    <SelectField
      name="size"
      clearable={false}
      choices={[
        ['small', 'Small'],
        ['medium', 'Medium'],
        ['large', 'Large'],
      ]}
      onChange={value => onSizeChange(value as string)}
      value={size}
    />
  );
};

export default SizeSelector;
