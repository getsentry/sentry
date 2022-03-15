import cloneDeep from 'lodash/cloneDeep';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {
  generateFieldAsString,
  getColumnsAndAggregates,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import Measurements, {
  MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {DataSet, DisplayType} from '../../utils';
import {BuildStep} from '../buildStep';

import {ColumnFields} from './columnFields';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  explodedAggregates: QueryFieldValue[];
  explodedColumns: QueryFieldValue[];
  explodedFields: QueryFieldValue[];
  onGetAmendedFieldOptions: (
    measurements: MeasurementCollection
  ) => ReturnType<typeof generateFieldOptions>;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  onYAxisOrColumnFieldChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
  queries: WidgetQuery[];
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function ColumnsStep({
  dataSet,
  displayType,
  onQueryChange,
  organization,
  queries,
  widgetType,
  onYAxisOrColumnFieldChange,
  onGetAmendedFieldOptions,
  queryErrors,
  explodedFields,
  explodedColumns,
  explodedAggregates,
}: Props) {
  return (
    <BuildStep
      title={t('Choose your columns')}
      description={
        dataSet !== DataSet.ISSUES
          ? tct(
              'To group events, add [functionLink: functions] f(x) that may take in additional parameters. [tagFieldLink: Tag and field] columns will help you view more details about the events (i.e. title).',
              {
                functionLink: (
                  <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                ),
                tagFieldLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
                ),
              }
            )
          : tct(
              '[tagFieldLink: Tag and field] columns will help you view more details about the issues (i.e. title).',
              {
                tagFieldLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
                ),
              }
            )
      }
    >
      {dataSet === DataSet.EVENTS ? (
        <Measurements>
          {({measurements}) => (
            <ColumnFields
              displayType={displayType}
              organization={organization}
              widgetType={widgetType}
              columns={explodedColumns}
              aggregates={explodedAggregates}
              fields={explodedFields}
              errors={queryErrors}
              fieldOptions={onGetAmendedFieldOptions(measurements)}
              onChange={onYAxisOrColumnFieldChange}
            />
          )}
        </Measurements>
      ) : (
        <ColumnFields
          displayType={displayType}
          organization={organization}
          widgetType={widgetType}
          columns={explodedColumns}
          aggregates={explodedAggregates}
          fields={explodedFields}
          errors={queryErrors?.[0] ? [queryErrors?.[0]] : undefined}
          fieldOptions={generateIssueWidgetFieldOptions()}
          onChange={newFields => {
            const fieldStrings = newFields.map(generateFieldAsString);
            const newQuery = cloneDeep(queries[0]);
            newQuery.fields = fieldStrings;
            const {columns, aggregates} = getColumnsAndAggregates(fieldStrings);
            newQuery.aggregates = aggregates;
            newQuery.columns = columns;
            onQueryChange(0, newQuery);
          }}
        />
      )}
    </BuildStep>
  );
}
