import {Organization} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {getDatasetConfig} from 'sentry/views/dashboardsV2/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {filterPrimaryOptions} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
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
  const datasetConfig = getDatasetConfig(WidgetType.RELEASE);
  const filterAggregateParameters = (option: FieldValueOption) => {
    return option.value.kind === FieldValueKind.METRICS;
  };
  return (
    <ColumnFields
      displayType={displayType}
      organization={organization}
      widgetType={widgetType}
      fields={explodedFields}
      errors={queryErrors?.[0] ? [queryErrors?.[0]] : undefined}
      fieldOptions={datasetConfig.getFieldOptions()}
      filterAggregateParameters={filterAggregateParameters}
      filterPrimaryOptions={option =>
        filterPrimaryOptions({
          option,
          widgetType,
          displayType,
        })
      }
      onChange={onYAxisOrColumnFieldChange}
    />
  );
}
