import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
<<<<<<< HEAD
import {QueryFieldValue} from 'sentry/utils/discover/fields';
=======
import {
  generateFieldAsString,
  getColumnsAndAggregatesAsStrings,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
>>>>>>> master
import {getDatasetConfig} from 'sentry/views/dashboardsV2/datasetConfig/base';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';

import {DataSet} from '../../utils';
import {BuildStep} from '../buildStep';

import {ColumnFields} from './columnFields';
import {ReleaseColumnFields} from './releaseColumnFields';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  explodedFields: QueryFieldValue[];
  handleColumnFieldChange: (newFields: QueryFieldValue[]) => void;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  organization: Organization;
  queries: WidgetQuery[];
  tags: TagCollection;
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function ColumnsStep({
  dataSet,
  displayType,
  organization,
  widgetType,
  handleColumnFieldChange,
  queryErrors,
  explodedFields,
  tags,
}: Props) {
  const datasetConfig = getDatasetConfig(widgetType);
  return (
    <BuildStep
      title={t('Choose your columns')}
      description={
        dataSet === DataSet.ISSUES
          ? tct(
              '[fieldTagLink: Field and tag] columns will help you view more details about the issues (e.g., title).',
              {
                fieldTagLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
                ),
              }
            )
          : dataSet === DataSet.RELEASES
          ? tct(
              'To stack sessions, add [functionLink: functions] f(x) that may take in additional parameters. [fieldTagLink: Field and tag] columns will help you view more details about the sessions (e.g., releases).',
              {
                functionLink: (
                  <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                ),
                fieldTagLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#release-properties" />
                ),
              }
            )
          : tct(
              'To stack events, add [functionLink: functions] f(x) that may take in additional parameters. [fieldTagLink: Field and tag] columns will help you view more details about the events (e.g., title).',
              {
                functionLink: (
                  <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                ),
                fieldTagLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
                ),
              }
            )
      }
    >
      {[DataSet.EVENTS, DataSet.ISSUES].includes(dataSet) ? (
        <ColumnFields
          displayType={displayType}
          organization={organization}
          widgetType={widgetType}
          fields={explodedFields}
          errors={queryErrors}
          fieldOptions={datasetConfig.getTableFieldOptions({organization}, tags)}
          onChange={handleColumnFieldChange}
        />
      ) : (
        <ReleaseColumnFields
          displayType={displayType}
          organization={organization}
          widgetType={widgetType}
          explodedFields={explodedFields}
          queryErrors={queryErrors}
          onYAxisOrColumnFieldChange={handleColumnFieldChange}
        />
      )}
    </BuildStep>
  );
}
