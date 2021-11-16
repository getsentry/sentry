import {SelectField} from 'app/components/forms';

type Props = {
  size: string;
  onSizeChange: (size: string) => void;
};

const SizeSelector = ({size, onSizeChange}: Props) => {
  return (
    <SelectField
      name="size"
      choices={[
        ['small', 'Small'],
        ['medium', 'Medium'],
        ['large', 'Large'],
      ]}
      onChange={value => onSizeChange(value as string)}
      value={size}
      style={{width: '120px', marginTop: '8px'}}
      clearable={false}
    />
  );
};

export default SizeSelector;
