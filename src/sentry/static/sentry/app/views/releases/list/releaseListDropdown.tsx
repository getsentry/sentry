import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';

type Option = {
  key: string;
  label: string;
};

type Props = {
  label: string;
  options: Option[];
  selected: string;
  onSelect: (key: string) => void;
};

const ReleaseListDropdown = ({label, options, selected, onSelect}: Props) => {
  const selectedOption = options.find(option => option.key === selected)?.label;

  return (
    <DropdownControl buttonProps={{prefix: label}} label={selectedOption}>
      {options.map(option => (
        <DropdownItem
          key={option.key}
          onSelect={onSelect}
          eventKey={option.key}
          isActive={selected === option.key}
        >
          {option.label}
        </DropdownItem>
      ))}
    </DropdownControl>
  );
};

export default ReleaseListDropdown;
