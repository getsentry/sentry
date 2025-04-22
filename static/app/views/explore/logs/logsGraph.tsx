import {t} from 'sentry/locale';
import usePrevious from 'sentry/utils/usePrevious';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {INGESTION_DELAY} from 'sentry/views/explore/settings';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

export interface LogsGraphProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function LogsGraph({timeseriesResult}: LogsGraphProps) {
  const previousTimeseriesResult = usePrevious(timeseriesResult);
  const usePreviousData =
    timeseriesResult.isPending && !!previousTimeseriesResult?.data?.length;
  const {
    data: dataMap,
    isPending,
    error,
  } = usePreviousData ? previousTimeseriesResult : timeseriesResult;
  const data = Object.values(dataMap)?.[0];

  const Title = <Widget.WidgetTitle title={t('count(logs)')} />;

  if (isPending) {
    return (
      <Widget
        Title={Title}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  if (error) {
    return <Widget Title={Title} Visualization={<Widget.WidgetError error={error} />} />;
  }

  if (!data || data?.length === 0) {
    return (
      <Widget Title={Title} Visualization={<Widget.WidgetError error={t('No data')} />} />
    );
  }

  return (
    <Widget
      Title={Title}
      Visualization={
        <TimeSeriesWidgetVisualization
          plottables={data.map(
            timeSeries =>
              new Bars(timeSeries, {
                delay: INGESTION_DELAY,
                stack: 'all',
              })
          )}
        />
      }
    />
  );
}
