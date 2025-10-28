import {Fragment, useMemo} from 'react';
import {parseAsStringEnum, useQueryState} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';

import {IconClock} from 'sentry/icons/iconClock';
import {IconGraph} from 'sentry/icons/iconGraph';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
import {getAIGenerationsFilter} from 'sentry/views/insights/agents/utils/query';
import {Referrer} from 'sentry/views/insights/aiGenerations/views/utils/referrer';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';

enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  AREA = 'area',
}

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

export function GenerationsChart() {
  const [interval, setInterval, intervalOptions] = useChartInterval();

  const [chartType, setChartType] = useQueryState(
    'chartType',
    parseAsStringEnum(Object.values(ChartType)).withDefault(ChartType.BAR)
  );

  const query = useCombinedQuery(getAIGenerationsFilter());

  const {data, isLoading, error} = useFetchSpanTimeSeries(
    {
      query,
      yAxis: ['count(span.duration)'],
      interval,
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
      Title={<Widget.WidgetTitle title="count(generations)" />}
      Actions={
        <Fragment>
          <CompactSelect
            triggerProps={{
              icon: <IconGraph type={chartType} />,
              borderless: true,
              showChevron: false,
              size: 'xs',
            }}
            value={chartType}
            menuTitle="Type"
            options={CHART_TYPE_OPTIONS}
            onChange={option => setChartType(option.value)}
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
            menuTitle="Interval"
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
