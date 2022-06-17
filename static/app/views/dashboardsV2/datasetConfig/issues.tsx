import {Client} from 'sentry/api';
import GroupStore from 'sentry/stores/groupStore';
import {Group, PageFilters} from 'sentry/types';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {queryToObj} from 'sentry/utils/stream';
import {DISCOVER_EXCLUSION_FIELDS, IssueSortOptions} from 'sentry/views/issueList/utils';

import {DEFAULT_TABLE_LIMIT, DisplayType, WidgetQuery} from '../types';
import {ISSUE_FIELD_TO_HEADER_MAP} from '../widgetBuilder/issueWidget/fields';
import {generateIssueWidgetFieldOptions} from '../widgetBuilder/issueWidget/utils';

import {ContextualProps, DatasetConfig} from './base';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['issue', 'assignee', 'title'] as string[],
  columns: ['issue', 'assignee', 'title'],
  fieldAliases: [],
  aggregates: [],
  conditions: '',
  orderby: IssueSortOptions.DATE,
};

const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_EXPAND = ['owners'];

type EndpointParams = Partial<PageFilters['datetime']> & {
  environment: string[];
  project: number[];
  collapse?: string[];
  cursor?: string;
  expand?: string[];
  groupStatsPeriod?: string | null;
  limit?: number;
  page?: number | string;
  query?: string;
  sort?: string;
  statsPeriod?: string | null;
};

export const IssuesConfig: DatasetConfig<never, Group[]> = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  getTableRequest,
  getCustomFieldRenderer: getIssueFieldRenderer,
  getTableFieldOptions: () => generateIssueWidgetFieldOptions(),
  fieldHeaderMap: ISSUE_FIELD_TO_HEADER_MAP,
  supportedDisplayTypes: [DisplayType.TABLE],
  transformTable: transformIssuesResponseToTable,
};

export function transformIssuesResponseToTable(
  data: Group[],
  widgetQuery: WidgetQuery,
  contextualProps?: ContextualProps
): TableData {
  GroupStore.add(data);
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
        .filter(key => ['number', 'string'].includes(typeof resultProps[key]))
        .forEach(key => {
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
        links: annotations?.join(', '),
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
      const queryTerms: string[] = [];
      if (typeof query === 'string') {
        const queryObj = queryToObj(query);
        for (const queryTag in queryObj) {
          if (!DISCOVER_EXCLUSION_FIELDS.includes(queryTag)) {
            const queryVal = queryObj[queryTag].includes(' ')
              ? `"${queryObj[queryTag]}"`
              : queryObj[queryTag];
            queryTerms.push(`${queryTag}:${queryVal}`);
          }
        }

        if (queryObj.__text) {
          queryTerms.push(queryObj.__text);
        }
      }
      transformedTableResult.discoverSearchQuery =
        (queryTerms.length ? ' ' : '') + queryTerms.join(' ');
      transformedTableResult.projectId = project.id;

      const {period, start, end} = contextualProps?.pageFilters?.datetime || {};
      if (start && end) {
        transformedTableResult.start = getUtcDateString(start);
        transformedTableResult.end = getUtcDateString(end);
      }
      transformedTableResult.period = period ?? '';
      transformedTableResults.push(transformedTableResult);
    }
  );
  return {data: transformedTableResults} as TableData;
}

function getTableRequest(
  api: Client,
  query: WidgetQuery,
  contextualProps?: ContextualProps,
  limit?: number,
  cursor?: string
) {
  const groupListUrl = `/organizations/${contextualProps?.organization?.slug}/issues/`;

  const params: EndpointParams = {
    project: contextualProps?.pageFilters?.projects ?? [],
    environment: contextualProps?.pageFilters?.environments ?? [],
    query: query.conditions,
    sort: query.orderby || DEFAULT_SORT,
    expand: DEFAULT_EXPAND,
    limit: limit ?? DEFAULT_TABLE_LIMIT,
    cursor,
  };

  if (contextualProps?.pageFilters?.datetime.period) {
    params.statsPeriod = contextualProps?.pageFilters?.datetime.period;
  }
  if (contextualProps?.pageFilters?.datetime.end) {
    params.end = getUtcDateString(contextualProps?.pageFilters?.datetime.end);
  }
  if (contextualProps?.pageFilters?.datetime.start) {
    params.start = getUtcDateString(contextualProps?.pageFilters?.datetime.start);
  }
  if (contextualProps?.pageFilters?.datetime.utc) {
    params.utc = contextualProps?.pageFilters?.datetime.utc;
  }

  return api.requestPromise(groupListUrl, {
    includeAllArgs: true,
    method: 'GET',
    data: {
      ...params,
    },
  });
}
