import type {ResponseMeta} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {
  IssuesConfig,
  type IssuesSeriesResponse,
} from 'sentry/views/dashboards/datasetConfig/issues';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type Props = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  // Optional selection override for widget viewer modal zoom functionality
  selection?: PageFilters;
  widgetInterval?: string;
};

export function IssueWidgetQueries({
  children,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  selection,
  widgetInterval,
}: Props) {
  const config = IssuesConfig;

  const afterFetchTableData = (_rawResult: Group[], response?: ResponseMeta) => {
    return {totalIssuesCount: response?.getResponseHeader('X-Hits') ?? undefined};
  };

  const {loading, ...rest} = useGenericWidgetQueries<IssuesSeriesResponse, Group[]>({
    config,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    selection,
    afterFetchTableData,
    skipDashboardFilterParens: true, // Issue widgets do not support parens in search
    widgetInterval,
  });

  return getDynamicText({
    value: children({
      loading,
      ...rest,
    }),
    fixed: <div />,
  });
}
