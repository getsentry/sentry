import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {IssuesSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar';
import {ISSUE_FIELD_TO_HEADER_MAP} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboards/widgetBuilder/issueWidget/utils';
import {
  useIssuesSeriesQuery,
  useIssuesTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useIssuesWidgetQuery';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useIssueListSearchBarDataProvider} from 'sentry/views/issueList/searchBar';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

import type {DatasetConfig} from './base';
import {
  type IssuesSeriesResponse,
  transformIssuesResponseToSeries,
} from './utils/transformIssuesResponseToSeries';
import {transformIssuesResponseToTable} from './utils/transformIssuesResponseToTable';

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

export const IssuesConfig: DatasetConfig<IssuesSeriesResponse, Group[]> = {
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
  getTimeseriesSortOptions: () => ({}),
  getTableFieldOptions: (organization, _tags, _customMeasurements, _api, displayType) =>
    generateIssueWidgetFieldOptions(organization, displayType),
  getFieldHeaderMap: () => ISSUE_FIELD_TO_HEADER_MAP,
  supportedDisplayTypes: [
    DisplayType.TABLE,
    DisplayType.AREA,
    DisplayType.LINE,
    DisplayType.BAR,
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

function filterYAxisOptions() {
  return function (option: FieldValueOption) {
    return option.value.kind === FieldValueKind.FUNCTION;
  };
}
