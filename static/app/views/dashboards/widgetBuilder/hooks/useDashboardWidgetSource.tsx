import {parseAsString, useQueryState} from 'nuqs';

import {defined} from 'sentry/utils';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';

export function useDashboardWidgetSource(): DashboardWidgetSource | '' {
  const [source] = useQueryState('source', parseAsString);

  const validSources = Object.values(
    DashboardWidgetSource
  ) satisfies DashboardWidgetSource[];

  return defined(source) && validSources.includes(source as DashboardWidgetSource)
    ? (source as DashboardWidgetSource)
    : DashboardWidgetSource.DASHBOARDS;
}
