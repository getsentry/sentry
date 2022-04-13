import {t} from 'sentry/locale';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  generateReleaseWidgetFieldOptions,
  SESSION_FIELDS,
  SESSION_TAGS,
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
        Object.keys(SESSION_FIELDS).map(key => SESSION_FIELDS[key]),
        SESSION_TAGS
      )}
      noFieldsMessage={t('There are no metrics for this project.')}
    />
  );
}
