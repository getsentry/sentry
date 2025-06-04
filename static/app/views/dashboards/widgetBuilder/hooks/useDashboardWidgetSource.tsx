import {defined} from 'sentry/utils';
import useUrlParams from 'sentry/utils/useUrlParams';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';

function useDashboardWidgetSource(): DashboardWidgetSource | '' {
  const {getParamValue} = useUrlParams('source');
  const source = getParamValue();

  const validSources = Object.values(
    DashboardWidgetSource
  ) satisfies DashboardWidgetSource[];

  return defined(source) && validSources.includes(source as DashboardWidgetSource)
    ? (source as DashboardWidgetSource)
    : DashboardWidgetSource.DASHBOARDS;
}

export default useDashboardWidgetSource;
