import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import usePrevious from 'sentry/utils/usePrevious';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {
  useLogsAggregateFunction,
  useLogsAggregateParam,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {INGESTION_DELAY} from 'sentry/views/explore/settings';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface LogsGraphProps {
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
  const aggregateFunction = useLogsAggregateFunction();
  const aggregateParam = useLogsAggregateParam();
  const displayedAggregateParam =
    aggregateFunction === 'count' ? t('logs') : prettifyTagKey(aggregateParam ?? 'logs');

  const Title = (
    <Widget.WidgetTitle title={`${aggregateFunction}(${displayedAggregateParam})`} />
  );

  if (isPending) {
    return (
      <Widget
        Title={Title}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  if (aggregateFunction !== 'count' && !aggregateParam) {
    return (
      <Widget
        Title={Title}
        Visualization={
          <Widget.WidgetError
            error={t(
              "Please specify a parameter for the '%s' aggregate",
              aggregateFunction
            )}
          />
        }
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
              new Bars(markDelayedData(timeSeries, INGESTION_DELAY), {
                stack: 'all',
              })
          )}
        />
      }
    />
  );
}
