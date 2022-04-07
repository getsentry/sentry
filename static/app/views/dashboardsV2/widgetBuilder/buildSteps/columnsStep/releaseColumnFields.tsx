import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {
  aggregateFunctionOutputType,
  isLegalYAxisType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateMetricsWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/metricWidget/fields';
import {FieldValueOption} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

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
  // Any function/field choice for Big Number widgets is legal since the
  // data source is from an endpoint that is not timeseries-based.
  // The function/field choice for World Map widget will need to be numeric-like.
  // Column builder for Table widget is already handled above.
  const doNotValidateYAxis = displayType === DisplayType.BIG_NUMBER;

  function filterPrimaryOptions(option: FieldValueOption) {
    if (displayType === DisplayType.TABLE) {
      return [FieldValueKind.FUNCTION, FieldValueKind.TAG].includes(option.value.kind);
    }

    // Only validate function names for timeseries widgets and
    // world map widgets.
    if (!doNotValidateYAxis && option.value.kind === FieldValueKind.FUNCTION) {
      const primaryOutput = aggregateFunctionOutputType(
        option.value.meta.name,
        undefined
      );
      if (primaryOutput) {
        // If a function returns a specific type, then validate it.
        return isLegalYAxisType(primaryOutput);
      }
    }

    return option.value.kind === FieldValueKind.FUNCTION;
  }

  return (
    <ColumnFields
      displayType={displayType}
      organization={organization}
      widgetType={widgetType}
      fields={explodedFields}
      errors={queryErrors?.[0] ? [queryErrors?.[0]] : undefined}
      fieldOptions={generateMetricsWidgetFieldOptions(
        Object.values(metas),
        Object.values(tags).map(({key}) => key)
      )}
      filterPrimaryOptions={filterPrimaryOptions}
      onChange={onYAxisOrColumnFieldChange}
      noFieldsMessage={t('There are no metrics for this project.')}
    />
  );
}
