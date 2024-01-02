import {ReactElement} from 'react';

import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';

export type Option = {
  label: string | ReactElement;
  value: string;
};

function SelectControlWithProps(props: ControlProps & {options: Option[]}) {
  return <SelectControl {...props} />;
}

export default SelectControlWithProps;
