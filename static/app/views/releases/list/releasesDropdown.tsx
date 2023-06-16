import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';

type Props = {
  label: string;
  onSelect: (key: string) => void;
  options: Record<string, Omit<SelectOption<string>, 'value'>>;
  selected: string;
};

function ReleasesDropdown({label: prefix, options, selected, onSelect}: Props) {
  const mappedOptions = Object.entries(options).map(
    ([key, {label, tooltip, disabled}]) => ({
      value: key,
      label,
      tooltip,
      disabled,
    })
  );

  return (
    <CompactSelect
      options={mappedOptions}
      onChange={opt => onSelect(opt.value)}
      value={selected}
      triggerProps={{prefix, style: {width: '100%'}}}
    />
  );
}

export default ReleasesDropdown;
