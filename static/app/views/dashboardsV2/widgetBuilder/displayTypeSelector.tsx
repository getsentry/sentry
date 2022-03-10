import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';

import {DisplayType, displayTypes} from './utils';

interface Props {
  displayType: DisplayType;
  onChange: (option: {label: string; value: DisplayType}) => void;
  widgetBuilderNewDesign: boolean;
  error?: string;
}

export function DisplayTypeSelector({
  displayType,
  onChange,
  error,
  widgetBuilderNewDesign,
}: Props) {
  const options = widgetBuilderNewDesign
    ? Object.keys(displayTypes).filter(type => type !== DisplayType.TOP_N)
    : Object.keys(displayTypes);

  return (
    <Field error={error} inline={false} flexibleControlStateSize stacked>
      <SelectControl
        name="displayType"
        options={options.map(value => ({
          label: displayTypes[value],
          value,
        }))}
        value={displayType}
        onChange={onChange}
      />
    </Field>
  );
}
