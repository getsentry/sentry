import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';

import {DisplayType, displayTypes} from './utils';

interface Props {
  displayType: DisplayType;
  onChange: (option: {label: string; value: DisplayType}) => void;
  error?: string;
}

export function DisplayTypeSelector({displayType, onChange, error}: Props) {
  return (
    <Field error={error} inline={false} flexibleControlStateSize stacked>
      <SelectControl
        name="displayType"
        options={Object.keys(displayTypes).map(value => ({
          label: displayTypes[value],
          value,
        }))}
        value={displayType}
        onChange={onChange}
      />
    </Field>
  );
}
