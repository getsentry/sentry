import {Fragment, useMemo, useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {
  useLogsAggregate,
  useLogsGroupBy,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {ConfidenceFooter} from 'sentry/views/explore/logs/confidenceFooter';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface LogsGraphProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function LogsGraph({timeseriesResult}: LogsGraphProps) {
  const aggregate = useLogsAggregate();
  const groupBy = useLogsGroupBy();

  const [chartType, setChartType] = useState<ChartType>(ChartType.BAR);
  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const chartInfo = useMemo(() => {
    const series = timeseriesResult.data[aggregate] ?? [];
    const isTopEvents = defined(groupBy);
    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);
    return {
      chartType,
      series,
      timeseriesResult,
      yAxis: aggregate,
      confidence: combineConfidenceForSeries(series),
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode: undefined,
      topEvents: isTopEvents ? TOP_EVENTS_LIMIT : undefined,
    };
  }, [chartType, timeseriesResult, aggregate, groupBy]);

  const Title = (
    <Widget.WidgetTitle title={prettifyAggregation(aggregate) ?? aggregate} />
  );

  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
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
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
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
  );

  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={<ChartVisualization chartInfo={chartInfo} />}
      Footer={
        <ConfidenceFooter chartInfo={chartInfo} isLoading={timeseriesResult.isLoading} />
      }
      revealActions="always"
    />
  );
}
