import {Fragment, useCallback, useMemo} from 'react';

import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock} from 'sentry/icons/iconClock';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import usePrevious from 'sentry/utils/usePrevious';
import {determineSeriesSampleCount} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/charts';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  DEFAULT_TOP_EVENTS,
  useMultiQueryTimeseries,
} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTimeseries';
import {
  type ReadableExploreQueryParts,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {INGESTION_DELAY} from 'sentry/views/explore/settings';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const CHART_HEIGHT = 260;
export interface MultiQueryChartProps {
  index: number;
  mode: Mode;
  query: ReadableExploreQueryParts;
}

export const EXPLORE_CHART_GROUP = 'multi-query-charts_group';

export function MultiQueryModeChart({
  index,
  query: queryParts,
  mode,
}: MultiQueryChartProps) {
  const {timeseriesResult, canUsePreviousResults} = useMultiQueryTimeseries({
    index,
    enabled: true,
  });
  const yAxes = queryParts.yAxes;
  const isTopN = mode === Mode.AGGREGATE;

  const confidence = useMemo(() => {
    const series = yAxes.flatMap(yAxis => timeseriesResult.data[yAxis]).filter(defined);
    return combineConfidenceForSeries(series);
  }, [timeseriesResult.data, yAxes]);

  const [interval, setInterval, intervalOptions] = useChartInterval();

  const formattedYAxes = yAxes.map(yaxis => {
    const func = parseFunction(yaxis);
    return func ? prettifyParsedFunction(func) : undefined;
  });

  const updateChartType = useUpdateQueryAtIndex(index);

  const previousTimeseriesResult = usePrevious(timeseriesResult);

  const getSeries = useCallback(() => {
    const shouldUsePreviousResults =
      timeseriesResult.isPending &&
      canUsePreviousResults &&
      yAxes.every(yAxis => previousTimeseriesResult.data.hasOwnProperty(yAxis));

    const data = yAxes.flatMap((yAxis, i) => {
      const series = shouldUsePreviousResults
        ? previousTimeseriesResult.data[yAxis]
        : timeseriesResult.data[yAxis];
      return (series ?? []).map(s => {
        // We replace the series name with the formatted series name here
        // when possible as it's cleaner to read.
        //
        // We can't do this in top N mode as the series name uses the row
        // values instead of the aggregate function.
        if (s.field === yAxis) {
          return {
            ...s,
            seriesName: formattedYAxes[i] ?? yAxis,
          };
        }
        return s;
      });
    });
    return {
      data,
      error: shouldUsePreviousResults
        ? previousTimeseriesResult.error
        : timeseriesResult.error,
      loading: shouldUsePreviousResults
        ? previousTimeseriesResult.isPending
        : timeseriesResult.isPending,
    };
  }, [
    timeseriesResult.isPending,
    timeseriesResult.error,
    timeseriesResult.data,
    canUsePreviousResults,
    yAxes,
    previousTimeseriesResult.error,
    previousTimeseriesResult.isPending,
    previousTimeseriesResult.data,
    formattedYAxes,
  ]);

  const {data, error, loading} = getSeries();
  const sampleCount = determineSeriesSampleCount(data, isTopN);

  const visualizationType =
    queryParts.chartType === ChartType.LINE
      ? 'line'
      : queryParts.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

  const chartInfo = {
    chartIcon: <IconGraph type={visualizationType} />,
    chartType: queryParts.chartType,
    yAxes,
    formattedYAxes,
    data,
    error,
    loading,
  };

  const Title = (
    <Fragment>
      <Widget.WidgetTitle title={formattedYAxes.filter(Boolean).join(', ')} />
    </Fragment>
  );

  if (chartInfo.loading) {
    return (
      <Widget
        key={index}
        height={CHART_HEIGHT}
        Title={Title}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        revealActions="always"
      />
    );
  }
  if (chartInfo.error) {
    return (
      <Widget
        key={index}
        height={CHART_HEIGHT}
        Title={Title}
        Visualization={<Widget.WidgetError error={chartInfo.error} />}
        revealActions="always"
      />
    );
  }

  return (
    <Widget
      key={index}
      height={CHART_HEIGHT}
      Title={Title}
      Actions={[
        <Tooltip
          key="visualization"
          title={t('Type of chart displayed in this visualization (ex. line)')}
        >
          <CompactSelect
            triggerProps={{
              icon: chartInfo.chartIcon,
              borderless: true,
              showChevron: false,
              size: 'xs',
            }}
            value={chartInfo.chartType}
            menuTitle={t('Type')}
            options={EXPLORE_CHART_TYPE_OPTIONS}
            onChange={option => {
              updateChartType({chartType: option.value});
            }}
          />
        </Tooltip>,
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
        </Tooltip>,
      ]}
      revealActions="always"
      Visualization={
        <TimeSeriesWidgetVisualization
          dataCompletenessDelay={INGESTION_DELAY}
          visualizationType={visualizationType}
          timeSeries={chartInfo.data}
        />
      }
      Footer={
        <ConfidenceFooter
          sampleCount={sampleCount}
          confidence={confidence}
          topEvents={isTopN ? DEFAULT_TOP_EVENTS : undefined}
        />
      }
    />
  );
}
