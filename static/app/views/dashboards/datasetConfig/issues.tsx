import {joinQuery, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import {getUtcDateString} from 'sentry/utils/dates';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {IssuesSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar';
import {
  ISSUE_FIELD_TO_HEADER_MAP,
  ISSUE_TABLE_FIELDS,
} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboards/widgetBuilder/issueWidget/utils';
import {
  useIssuesSeriesQuery,
  useIssuesTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useIssuesWidgetQuery';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useIssueListSearchBarDataProvider} from 'sentry/views/issueList/searchBar';
import {
  DISCOVER_EXCLUSION_FIELDS,
  getSortLabel,
  IssueSortOptions,
} from 'sentry/views/issueList/utils';

import type {DatasetConfig} from './base';

const DEFAULT_TABLE_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['issue', 'assignee', 'title'] as string[],
  columns: ['issue', 'assignee', 'title'],
  fieldAliases: [],
  aggregates: [],
  conditions: '',
  orderby: IssueSortOptions.DATE,
};

const DEFAULT_ISSUE_SERIES_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count(new_issues)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count(new_issues)'],
  conditions: '',
  orderby: '-count(new_issues)',
};

const DEFAULT_FIELD: QueryFieldValue = {
  field: 'issue',
  kind: FieldValueKind.FIELD,
};

const DEFAULT_SERIES_FIELD: QueryFieldValue = {
  function: ['count', 'new_issues', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

export type IssuesSeriesResponse = {
  timeSeries: TimeSeries[];
  meta?: {
    dataset: string;
    end: number;
    start: number;
  };
};

export const IssuesConfig: DatasetConfig<IssuesSeriesResponse, Group[]> = {
  defaultCategoryField: 'project',
  defaultField: DEFAULT_FIELD,
  defaultSeriesField: DEFAULT_SERIES_FIELD,
  defaultWidgetQuery: DEFAULT_TABLE_WIDGET_QUERY,
  defaultSeriesWidgetQuery: DEFAULT_ISSUE_SERIES_WIDGET_QUERY,
  enableEquations: false,
  disableSortOptions,
  getCustomFieldRenderer: getIssueFieldRenderer,
  SearchBar: IssuesSearchBar,
  useSearchBarDataProvider: useIssueListSearchBarDataProvider,
  transformSeries: transformIssuesResponseToSeries,
  filterYAxisOptions,
  getTableSortOptions,
  getTableFieldOptions: (organization, _tags, _customMeasurements, _api, displayType) =>
    generateIssueWidgetFieldOptions(organization, displayType),
  getFieldHeaderMap: () => ISSUE_FIELD_TO_HEADER_MAP,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.CATEGORICAL_BAR,
    DisplayType.LINE,
    DisplayType.TABLE,
  ],
  transformTable: transformIssuesResponseToTable,
  useSeriesQuery: useIssuesSeriesQuery,
  useTableQuery: useIssuesTableQuery,
};

function disableSortOptions(_widgetQuery: WidgetQuery) {
  return {
    disableSort: false,
    disableSortDirection: true,
    disableSortReason: t('Issues dataset does not yet support sorting in opposite order'),
  };
}

function getTableSortOptions(_organization: Organization, _widgetQuery: WidgetQuery) {
  const sortOptions = [
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    IssueSortOptions.TRENDS,
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
  ];
  return sortOptions.map(sortOption => ({
    label: getSortLabel(sortOption),
    value: sortOption,
  }));
}

export function transformIssuesResponseToTable(
  data: Group[],
  widgetQuery: WidgetQuery,
  _organization: Organization,
  pageFilters: PageFilters
): TableData {
  const transformedTableResults: TableDataRow[] = [];
  data.forEach(
    ({
      id,
      shortId,
      title,
      lifetime,
      filtered,
      count,
      userCount,
      project,
      annotations,
      ...resultProps
    }) => {
      const transformedResultProps: Omit<TableDataRow, 'id'> = {};
      Object.keys(resultProps)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .filter(key => ['number', 'string'].includes(typeof resultProps[key]))
        .forEach(key => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          transformedResultProps[key] = resultProps[key];
        });

      const transformedTableResult: TableDataRow = {
        ...transformedResultProps,
        events: count,
        users: userCount,
        id,
        'issue.id': id,
        issue: shortId,
        title,
        project: project.slug,
        links: (annotations ?? []) as any,
      };

      // Get lifetime stats
      if (lifetime) {
        transformedTableResult.lifetimeEvents = lifetime?.count;
        transformedTableResult.lifetimeUsers = lifetime?.userCount;
      }
      // Get filtered stats
      if (filtered) {
        transformedTableResult.filteredEvents = filtered?.count;
        transformedTableResult.filteredUsers = filtered?.userCount;
      }

      // Discover Url properties
      const query = widgetQuery.conditions;
      const parsedResult = parseSearch(query);
      const filteredTerms = parsedResult?.filter(
        p => !(p.type === Token.FILTER && DISCOVER_EXCLUSION_FIELDS.includes(p.key.text))
      );

      transformedTableResult.discoverSearchQuery = joinQuery(filteredTerms, true);
      transformedTableResult.projectId = project.id;

      const {period, start, end} = pageFilters.datetime || {};
      if (start && end) {
        transformedTableResult.start = getUtcDateString(start);
        transformedTableResult.end = getUtcDateString(end);
      }
      transformedTableResult.period = period ?? '';
      transformedTableResults.push(transformedTableResult);
    }
  );

  return {
    data: transformedTableResults,
    meta: {fields: ISSUE_TABLE_FIELDS},
  };
}

function filterYAxisOptions() {
  return function (option: FieldValueOption) {
    return option.value.kind === FieldValueKind.FUNCTION;
  };
}

export function transformIssuesResponseToSeries(data: IssuesSeriesResponse): Series[] {
  return data.timeSeries.map(timeSeries => ({
    seriesName: timeSeries.yAxis,
    data: timeSeries.values.map(item => ({
      name: item.timestamp,
      value: item.value ?? 0,
    })),
  }));
}
