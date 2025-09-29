import {Fragment, useMemo} from 'react';

import {Widget} from 'sentry/views/explore/components/widget';
import {
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {prettifyAggregation} from 'sentry/views/insights/common/utils/prettifyAggregation';

interface MetricsGraphProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function MetricsGraph({timeseriesResult}: MetricsGraphProps) {
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();

  function handleChartTypeChange(index: number, chartType: ChartType) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({chartType});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  function handleChartVisibilityChange(index: number, visible: boolean) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({visible});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  return (
    <Fragment>
      {visualizes.map((visualize, index) => {
        return (
          <Graph
            key={index}
            visualize={visualize}
            timeseriesResult={timeseriesResult}
            onChartTypeChange={chartType => handleChartTypeChange(index, chartType)}
            onChartVisibilityChange={visible =>
              handleChartVisibilityChange(index, visible)
            }
          />
        );
      })}
    </Fragment>
  );
}

interface GraphProps extends MetricsGraphProps {
  onChartTypeChange: (chartType: ChartType) => void;
  onChartVisibilityChange: (visible: boolean) => void;
  visualize: any;
}

function Graph({
  onChartTypeChange,
  onChartVisibilityChange,
  timeseriesResult,
  visualize,
}: GraphProps) {
  const aggregate = visualize.yAxis;

  const chartInfo = useMemo(() => {
    const series = timeseriesResult.data[aggregate] ?? [];
    return {
      chartType: visualize.chartType,
      series,
      timeseriesResult,
      yAxis: aggregate,
    };
  }, [visualize.chartType, timeseriesResult, aggregate]);

  const Title = (
    <Widget.WidgetTitle title={prettifyAggregation(aggregate) ?? aggregate} />
  );

  if (!visualize.visible) {
    return null;
  }

  return (
    <Widget.Widget>
      <Widget.WidgetHeader>
        {Title}
        <Widget.WidgetActions>
          {/* TODO: Add chart actions similar to logs */}
        </Widget.WidgetActions>
      </Widget.WidgetHeader>
      <Widget.WidgetBody>
        {/* TODO: Add actual chart component */}
        <div>Chart placeholder for {aggregate}</div>
      </Widget.WidgetBody>
    </Widget.Widget>
  );
}
