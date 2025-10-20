import {Fragment, useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {ConfidenceFooter} from 'sentry/views/explore/metrics/confidenceFooter';
import {
  useMetricVisualize,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {getQuerySymbol} from 'sentry/views/explore/metrics/metricToolbar/querySymbol';
import {useQueryParamsTopEventsLimit} from 'sentry/views/explore/queryParams/context';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface MetricsGraphProps {
  queryIndex: number;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function MetricsGraph({timeseriesResult, queryIndex}: MetricsGraphProps) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();

  function handleChartTypeChange(newChartType: ChartType) {
    setVisualize(visualize.replace({chartType: newChartType}));
  }

  return (
    <Graph
      visualize={visualize}
      timeseriesResult={timeseriesResult}
      onChartTypeChange={handleChartTypeChange}
      queryIndex={queryIndex}
    />
  );
}

interface GraphProps extends MetricsGraphProps {
  onChartTypeChange: (chartType: ChartType) => void;
  queryIndex: number;
  visualize: ReturnType<typeof useMetricVisualize>;
}

function Graph({onChartTypeChange, timeseriesResult, queryIndex, visualize}: GraphProps) {
  const aggregate = visualize.yAxis;
  const topEventsLimit = useQueryParamsTopEventsLimit();

  const [interval, setInterval, intervalOptions] = useChartInterval();

  const chartInfo = useMemo(() => {
    const series = timeseriesResult.data[aggregate] ?? [];
    const isTopEvents = defined(topEventsLimit);
    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);
    return {
      chartType: visualize.chartType,
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
  }, [visualize.chartType, timeseriesResult, aggregate, topEventsLimit]);

  const Title = (
    <Widget.WidgetTitle
      title={`${getQuerySymbol(queryIndex)}: ${prettifyAggregation(aggregate) ?? aggregate}`}
    />
  );

  const chartIcon =
    visualize.chartType === ChartType.LINE
      ? 'line'
      : visualize.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

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
          value={visualize.chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => onChartTypeChange(option.value)}
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

  // We explicitly only want to show the confidence footer if we have
  // scanned partial data.
  const showConfidenceFooter =
    chartInfo.dataScanned !== 'full' && !timeseriesResult.isLoading;
  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={visualize.visible && <ChartVisualization chartInfo={chartInfo} />}
      Footer={
        showConfidenceFooter && (
          <ConfidenceFooter
            chartInfo={chartInfo}
            isLoading={timeseriesResult.isLoading}
          />
        )
      }
      revealActions="always"
      borderless
    />
  );
}
