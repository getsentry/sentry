import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateReleaseWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';
import {filterPrimaryOptions} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

import {ColumnFields} from './columnFields';

interface Props {
  displayType: DisplayType;
  explodedFields: QueryFieldValue[];
  onYAxisOrColumnFieldChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function ReleaseColumnFields({
  displayType,
  organization,
  widgetType,
  explodedFields,
  queryErrors,
  onYAxisOrColumnFieldChange,
}: Props) {
  const {metas, tags} = useMetricsContext();

  return (
    <ColumnFields
      displayType={displayType}
      organization={organization}
      widgetType={widgetType}
      fields={explodedFields}
      errors={queryErrors?.[0] ? [queryErrors?.[0]] : undefined}
      fieldOptions={generateReleaseWidgetFieldOptions(
        Object.values(metas),
        Object.values(tags).map(({key}) => key)
      )}
      filterPrimaryOptions={option =>
        filterPrimaryOptions({
          option,
          widgetType,
          displayType,
        })
      }
      onChange={onYAxisOrColumnFieldChange}
      noFieldsMessage={t('There are no metrics for this project.')}
    />
  );
}
