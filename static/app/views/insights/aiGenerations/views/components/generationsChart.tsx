import {Fragment, useMemo} from 'react';

import {CompactSelect} from '@sentry/scraps/compactSelect';

import {IconClock} from 'sentry/icons/iconClock';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  useQueryParamsGroupBys,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
import {AI_GENERATIONS_PAGE_FILTER} from 'sentry/views/insights/aiGenerations/views/utils/constants';
import {Referrer} from 'sentry/views/insights/aiGenerations/views/utils/referrer';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import type {SpanFields} from 'sentry/views/insights/types';

const CHART_TYPE_OPTIONS = [
  {
    value: ChartType.BAR,
    label: 'Bar',
  },
  {
    value: ChartType.LINE,
    label: 'Line',
  },
  {
    value: ChartType.AREA,
    label: 'Area',
  },
];

const plottableConstructors: Record<
  ChartType,
  new (timeSeries: TimeSeries) => Plottable
> = {
  [ChartType.BAR]: Bars,
  [ChartType.LINE]: Line,
  [ChartType.AREA]: Area,
};

const chartTypeIconMap: Record<ChartType, 'line' | 'bar' | 'area'> = {
  [ChartType.BAR]: 'bar',
  [ChartType.LINE]: 'line',
  [ChartType.AREA]: 'area',
};

function prettifyAggregation(aggregation: string): string {
  if (aggregation === 'count(span.duration)') {
    return 'count(generations)';
  }
  return aggregation;
}

export function GenerationsChart() {
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

  return (
    <Fragment>
      {visualizes.map((visualize, index) => {
        return (
          <ChartWidget
            key={index}
            visualize={visualize}
            onChartTypeChange={chartType => handleChartTypeChange(index, chartType)}
          />
        );
      })}
    </Fragment>
  );
}

function ChartWidget({
  visualize,
  onChartTypeChange,
}: {
  onChartTypeChange: (chartType: ChartType) => void;
  visualize: Visualize;
}) {
  const groupBys = useQueryParamsGroupBys().filter(Boolean);
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const chartType = visualize.chartType;

  const query = useCombinedQuery(AI_GENERATIONS_PAGE_FILTER);
  const {data, isLoading, error} = useFetchSpanTimeSeries(
    {
      query,
      yAxis: [visualize.yAxis] as any,
      groupBy: groupBys as SpanFields[],
      interval,
      sort:
        groupBys.length > 0 && groupBys[0]
          ? {
              field: groupBys[0],
              kind: 'desc' as const,
            }
          : undefined,
      topEvents: groupBys.length > 0 ? 5 : undefined,
    },
    Referrer.GENERATIONS_CHART
  );

  const plottables = useMemo(() => {
    return (
      data?.timeSeries.map(
        timeSeries => new plottableConstructors[chartType](timeSeries)
      ) ?? []
    );
  }, [chartType, data?.timeSeries]);

  const isEmpty = useMemo(
    () => plottables.every(plottable => plottable.isEmpty),
    [plottables]
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={prettifyAggregation(visualize.yAxis)} />}
      Actions={
        <Fragment>
          <CompactSelect
            triggerProps={{
              icon: <IconGraph type={chartTypeIconMap[chartType]} />,
              borderless: true,
              showChevron: false,
              size: 'xs',
            }}
            value={chartType}
            menuTitle={t('Type')}
            options={CHART_TYPE_OPTIONS}
            onChange={option => onChartTypeChange(option.value)}
          />
          <CompactSelect
            value={interval}
            onChange={option => setInterval(option.value)}
            triggerProps={{
              icon: <IconClock />,
              borderless: true,
              showChevron: false,
              size: 'xs',
            }}
            menuTitle={t('Interval')}
            options={intervalOptions}
          />
        </Fragment>
      }
      revealActions="always"
      Visualization={
        <WidgetVisualizationStates
          isLoading={isLoading}
          error={error}
          isEmpty={isEmpty}
          VisualizationType={TimeSeriesWidgetVisualization}
          visualizationProps={{
            plottables,
          }}
        />
      }
      height={200}
    />
  );
}
