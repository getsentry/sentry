import {Fragment, useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import usePrevious from 'sentry/utils/usePrevious';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/charts';
import {
  useLogsAggregateFunction,
  useLogsAggregateParam,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {INGESTION_DELAY} from 'sentry/views/explore/settings';
import {ChartType} from 'sentry/views/insights/common/components/chart';
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
  const [chartType, setChartType] = useState<ChartType>(ChartType.BAR);
  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

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

  const DataPlottableConstructor =
    chartType === ChartType.LINE ? Line : chartType === ChartType.AREA ? Area : Bars;
  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  return (
    <Widget
      Title={Title}
      Actions={
        <Fragment>
          <Tooltip
            key="visualization"
            title={t('Type of chart displayed in this visualization (ex. line)')}
          >
            <CompactSelect
              triggerProps={{
                icon: <IconGraph type={chartIcon} />,
                borderless: true,
                showChevron: false,
                size: 'xs',
              }}
              value={chartType}
              menuTitle="Type"
              options={EXPLORE_CHART_TYPE_OPTIONS}
              onChange={option => setChartType(option.value)}
            />
          </Tooltip>
          <Tooltip
            key="interval"
            title={t('Time interval displayed in this visualization (ex. 5m)')}
          >
            <CompactSelect
              value={interval}
              onChange={({value}) => setInterval(value)}
              triggerProps={{
                icon: <IconClock />,
                borderless: true,
                showChevron: false,
                size: 'xs',
              }}
              menuTitle="Interval"
              options={intervalOptions}
            />
          </Tooltip>
        </Fragment>
      }
      revealActions="always"
      Visualization={
        <TimeSeriesWidgetVisualization
          plottables={data.map(
            timeSeries =>
              new DataPlottableConstructor(markDelayedData(timeSeries, INGESTION_DELAY), {
                stack: 'all',
              })
          )}
        />
      }
    />
  );
}
