import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  generateReleaseWidgetFieldOptions,
  SESSIONS_FIELDS,
  SESSIONS_TAGS,
} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';

import {YAxisSelector} from './yAxisSelector';

interface Props {
  aggregates: QueryFieldValue[];
  displayType: DisplayType;
  onChange: (newFields: QueryFieldValue[]) => void;
  widgetType: WidgetType;
  errors?: Record<string, any>[];
}

export function ReleaseYAxisSelector({
  aggregates,
  displayType,
  widgetType,
  onChange,
  errors,
}: Props) {
  return (
    <YAxisSelector
      widgetType={widgetType}
      displayType={displayType}
      aggregates={aggregates}
      onChange={onChange}
      errors={errors}
      fieldOptions={generateReleaseWidgetFieldOptions(
        Object.values(SESSIONS_FIELDS),
        SESSIONS_TAGS
      )}
    />
  );
}
