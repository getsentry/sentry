import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {TOP_N} from 'sentry/utils/discover/types';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DEFAULT_TABLE_LIMIT, DisplayType} from 'sentry/views/dashboards/types';

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
    timeseriesResults?: GenericWidgetQueriesResult['timeseriesResults'];
  }) => void;
  // Optional selection override for widget viewer modal zoom functionality
  selection?: PageFilters;
  widgetInterval?: string;
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
