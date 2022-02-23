import {OptionProps} from 'react-select';

import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import SelectOption from 'sentry/components/forms/selectOption';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {SelectValue} from 'sentry/types';
import {DashboardListItem, MAX_WIDGETS} from 'sentry/views/dashboardsV2/types';

interface Props {
  dashboards: DashboardListItem[];
  disabled: boolean;
  onChange: (dashboard: SelectValue<string>) => void;
  error?: string;
}

export function DashboardSelector({dashboards, disabled, onChange, error}: Props) {
  return (
    <Field inline={false} flexibleControlStateSize stacked error={error} required>
      <SelectControl
        menuPlacement="auto"
        name="dashboard"
        options={[
          {label: t('+ Create New Dashboard'), value: 'new'},
          ...dashboards.map(({title, id, widgetDisplay}) => ({
            label: title,
            value: id,
            isDisabled: widgetDisplay.length >= MAX_WIDGETS,
          })),
        ]}
        onChange={(option: SelectValue<string>) => {
          onChange(option);
        }}
        disabled={disabled}
        components={{
          Option: ({label, data, ...optionProps}: OptionProps<any>) => (
            <Tooltip
              disabled={!!!data.isDisabled}
              title={tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                maxWidgets: MAX_WIDGETS,
              })}
              containerDisplayMode="block"
              position="right"
            >
              <SelectOption label={label} data={data} {...(optionProps as any)} />
            </Tooltip>
          ),
        }}
      />
    </Field>
  );
}
