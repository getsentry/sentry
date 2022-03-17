import cloneDeep from 'lodash/cloneDeep';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {
  generateFieldAsString,
  getColumnsAndAggregatesAsStrings,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';

import {DataSet, getAmendedFieldOptions} from '../../utils';
import {BuildStep} from '../buildStep';

import {ColumnFields} from './columnFields';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  explodedAggregates: QueryFieldValue[];
  explodedColumns: QueryFieldValue[];
  explodedFields: QueryFieldValue[];
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  onYAxisOrColumnFieldChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
  queries: WidgetQuery[];
  tags: TagCollection;
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
  queryErrors,
  explodedFields,
  explodedColumns,
  explodedAggregates,
  tags,
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
              fieldOptions={getAmendedFieldOptions({measurements, organization, tags})}
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
            const splitFields = getColumnsAndAggregatesAsStrings(newFields);
            const newQuery = cloneDeep(queries[0]);
            newQuery.fields = fieldStrings;
            newQuery.aggregates = splitFields.aggregates;
            newQuery.columns = splitFields.columns;
            onQueryChange(0, newQuery);
          }}
        />
      )}
    </BuildStep>
  );
}
