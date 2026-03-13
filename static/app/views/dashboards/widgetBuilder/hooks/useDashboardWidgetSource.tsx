import {defined} from 'sentry/utils';
import {useUrlParams} from 'sentry/utils/url/useUrlParams';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';

export function useDashboardWidgetSource(): DashboardWidgetSource | '' {
  const {getParamValue} = useUrlParams('source');
  const source = getParamValue();

  const validSources = Object.values(
    DashboardWidgetSource
  ) satisfies DashboardWidgetSource[];

  return defined(source) && validSources.includes(source as DashboardWidgetSource)
    ? (source as DashboardWidgetSource)
    : DashboardWidgetSource.DASHBOARDS;
}
