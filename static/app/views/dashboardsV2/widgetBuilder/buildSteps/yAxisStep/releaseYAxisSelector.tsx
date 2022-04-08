import {t} from 'sentry/locale';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateMetricsWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/metricWidget/fields';

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
  const {metas, tags} = useMetricsContext();

  return (
    <YAxisSelector
      widgetType={widgetType}
      displayType={displayType}
      aggregates={aggregates}
      onChange={onChange}
      errors={errors}
      fieldOptions={generateMetricsWidgetFieldOptions(
        Object.values(metas),
        Object.values(tags).map(({key}) => key)
      )}
      noFieldsMessage={t('There are no metrics for this project.')}
    />
  );
}
