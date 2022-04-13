import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {
  aggregateFunctionOutputType,
  isLegalYAxisType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  generateMetricsWidgetFieldOptions,
  SESSION_FIELDS,
  SESSION_TAGS,
} from 'sentry/views/dashboardsV2/widgetBuilder/metricWidget/fields';
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
        Object.keys(SESSION_FIELDS).map(key => SESSION_FIELDS[key]),
        SESSION_TAGS
      )}
      filterPrimaryOptions={filterPrimaryOptions}
      onChange={onYAxisOrColumnFieldChange}
      noFieldsMessage={t('There are no metrics for this project.')}
    />
  );
}
