import trimStart from 'lodash/trimStart';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {stripDerivedMetricsPrefix} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import type {DashboardFilters, Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DEFAULT_TABLE_LIMIT, DisplayType} from 'sentry/views/dashboards/types';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
  METRICS_EXPRESSION_TO_FIELD,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

import type {GenericWidgetQueriesResult} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

interface ReleaseWidgetQueriesProps {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: {
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
  }) => void;
  // Optional selection override for widget viewer modal zoom functionality
  selection?: PageFilters;
  widgetInterval?: string;
}

export function derivedMetricsToField(field: string): string {
  return METRICS_EXPRESSION_TO_FIELD[field] ?? field;
}

/**
 * Given a list of requested fields, this function returns
 * 'aggregates' which is a list of aggregate functions that
 * can be passed to either Metrics or Sessions endpoints,
 * 'derivedStatusFields' which need to be requested from the
 * Metrics endpoint and 'injectFields' which are fields not
 * requested but required to calculate the value of a derived
 * status field so will need to be stripped away in post processing.
 */
export function resolveDerivedStatusFields(
  fields: string[],
  orderby: string,
  useSessionAPI: boolean
): {
  aggregates: string[];
  derivedStatusFields: string[];
  injectedFields: string[];
} {
  const aggregates = fields.map(stripDerivedMetricsPrefix);
  const derivedStatusFields = aggregates.filter(agg =>
    Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
  );

  const injectedFields: string[] = [];

  const rawOrderby = trimStart(orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';

  if (rawOrderby && !unsupportedOrderby && !fields.includes(rawOrderby)) {
    if (!injectedFields.includes(rawOrderby)) {
      injectedFields.push(rawOrderby);
    }
  }

  if (!useSessionAPI) {
    return {aggregates, derivedStatusFields, injectedFields};
  }

  derivedStatusFields.forEach(field => {
    const result = field.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (result[2] === 'user' && !aggregates.includes('count_unique(user)')) {
        injectedFields.push('count_unique(user)');
        aggregates.push('count_unique(user)');
      }
      if (result[2] === 'session' && !aggregates.includes('sum(session)')) {
        injectedFields.push('sum(session)');
        aggregates.push('sum(session)');
      }
    }
  });

  return {aggregates, derivedStatusFields, injectedFields};
}

export function requiresCustomReleaseSorting(query: WidgetQuery): boolean {
  const useMetricsAPI = !query.columns.includes('session.status');
  const rawOrderby = trimStart(query.orderby, '-');
  return useMetricsAPI && rawOrderby === 'release';
}

function getLimit(displayType: DisplayType, limit?: number) {
  switch (displayType) {
    case DisplayType.TOP_N:
      return TOP_N;
    case DisplayType.TABLE:
      return limit ?? DEFAULT_TABLE_LIMIT;
    case DisplayType.BIG_NUMBER:
      return 1;
    default:
      return limit ?? 20; // TODO(dam): Can be changed to undefined once [INGEST-1079] is resolved
  }
}

export function ReleaseWidgetQueries({
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onDataFetchStart,
  selection,
  children,
  widgetInterval,
}: ReleaseWidgetQueriesProps) {
  const props = useGenericWidgetQueries<SessionApiResponse, SessionApiResponse>({
    config: ReleasesConfig,
    widget,
    dashboardFilters,
    cursor,
    limit: getLimit(widget.displayType, limit),
    onDataFetched,
    onDataFetchStart,
    selection,
    widgetInterval,
  });

  return children(props);
}
