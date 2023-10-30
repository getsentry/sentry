import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';

export type Option = {
  label: string;
  value: string;
};

function SelectControlWithProps(props: ControlProps & {options: Option[]}) {
  return <SelectControl {...props} />;
}

export default SelectControlWithProps;
