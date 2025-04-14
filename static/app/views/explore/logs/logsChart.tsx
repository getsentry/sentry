import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useLogsSearch} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

export function LogsChart() {
  const logsSearch = useLogsSearch();
  let [interval] = useChartInterval();
  const pageFilters = usePageFilters();
  const chartIntervalInMinutes = getDiffInMinutes(pageFilters.selection.datetime);

  // Force the lowest granularity if the user has zoomed deeply into the logs.
  if (chartIntervalInMinutes < 60) {
    interval = '1m';
  }

  const {
    data: timeSeriesRawData,
    isLoading: isTimeSeriesLoading,
    isFetching: isTimeSeriesFetching,
    error: timeSeriesError,
  } = useSortedTimeSeries(
    {
      search: logsSearch,
      yAxis: ['count()'],
      interval,
    },
    'explore.ourlogs.main-chart',
    DiscoverDatasets.OURLOGS
  );
  const timeSeriesData = Object.values(timeSeriesRawData ?? {})
    .map(x => x[0])
    .find(() => true);

  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];
  if (releases?.length > 50) {
    releases.splice(0, releases.length);
  }

  if (timeSeriesError) {
    return <Widget.WidgetError error={timeSeriesError} />;
  }

  if (!timeSeriesData) {
    return <Widget.WidgetError error={t('No data to plot.')} />;
  }

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('count(logs)')} />}
      Visualization={
        isTimeSeriesLoading || isTimeSeriesFetching || !timeSeriesData ? (
          <TimeSeriesWidgetVisualization.LoadingPlaceholder />
        ) : (
          <TimeSeriesWidgetVisualization
            plottables={[new Bars(timeSeriesData)]}
            releases={releases}
          />
        )
      }
      height={200} // TODO: this is not working properly without height specified
    />
  );
}
