import {Fragment, useCallback} from 'react';

import {IconGraph} from 'sentry/icons/iconGraph';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import usePrevious from 'sentry/utils/usePrevious';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {ErrorPanel} from 'sentry/views/dashboards/widgets/widgetLayout/errorPanel';
import {LoadingPanel} from 'sentry/views/dashboards/widgets/widgetLayout/loadingPanel';
import {WidgetLayout} from 'sentry/views/dashboards/widgets/widgetLayout/widgetLayout';
import {WidgetTitle} from 'sentry/views/dashboards/widgets/widgetLayout/widgetTitle';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useMultiQueryTimeseries} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTimeseries';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {INGESTION_DELAY} from 'sentry/views/explore/settings';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const CHART_HEIGHT = 260;
export interface MultiQueryChartProps {
  index: number;
  mode: Mode;
  query: ReadableExploreQueryParts;
}

export const EXPLORE_CHART_GROUP = 'multi-query-charts_group';

export function MultiQueryModeChart({index, query: queryParts}: MultiQueryChartProps) {
  const {timeseriesResult, canUsePreviousResults} = useMultiQueryTimeseries({
    index,
    enabled: true,
  });
  const yAxes = queryParts.yAxes;

  const formattedYAxes = yAxes.map(yaxis => {
    const func = parseFunction(yaxis);
    return func ? prettifyParsedFunction(func) : undefined;
  });

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

  const chartInfo = {
    chartIcon: <IconGraph type={'line'} />,
    chartType: ChartType.LINE,
    yAxes,
    formattedYAxes,
    data,
    error,
    loading,
  };

  const Title = (
    <Fragment>
      <WidgetTitle title={formattedYAxes.filter(Boolean).join(', ')} />
    </Fragment>
  );

  if (chartInfo.loading) {
    return (
      <WidgetLayout
        key={index}
        height={CHART_HEIGHT}
        Title={Title}
        Visualization={<LoadingPanel />}
        revealActions="always"
      />
    );
  }
  if (chartInfo.error) {
    return (
      <WidgetLayout
        key={index}
        height={CHART_HEIGHT}
        Title={Title}
        Visualization={<ErrorPanel error={chartInfo.error} />}
        revealActions="always"
      />
    );
  }

  return (
    <WidgetLayout
      key={index}
      height={CHART_HEIGHT}
      Title={Title}
      revealActions="always"
      Visualization={
        <TimeSeriesWidgetVisualization
          dataCompletenessDelay={INGESTION_DELAY}
          visualizationType={
            chartInfo.chartType === ChartType.AREA
              ? 'area'
              : chartInfo.chartType === ChartType.LINE
                ? 'line'
                : 'bar'
          }
          timeSeries={chartInfo.data}
        />
      }
    />
  );
}
