import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {DisplayType} from 'sentry/views/dashboardsV2/types';

import {displayTypes} from './utils';

const DISPLAY_TYPES_OPTIONS = Object.keys(displayTypes).map(value => ({
  label: displayTypes[value],
  value,
}));

type Props = {
  displayType: DisplayType;
  onChange: (option: {label: string; value: DisplayType}) => void;
  error?: string;
};

export function DisplayTypeSelector({displayType, onChange, error}: Props) {
  return (
    <Field error={error} inline={false} flexibleControlStateSize stacked required>
      <SelectControl
        name="displayType"
        options={DISPLAY_TYPES_OPTIONS}
        value={displayType}
        onChange={onChange}
      />
    </Field>
  );
}
