import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/laravel/styles';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';

export function DurationWidget({
  query,
  releases,
}: {
  query?: string;
  releases?: Release[];
}) {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  const fullQuery = `span.op:http.server ${query}`.trim();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          yAxis: ['avg(span.duration)', 'p95(span.duration)'],
          orderby: 'avg(span.duration)',
          partial: 1,
          useRpc: 1,
          query: fullQuery,
          referrer: Referrer.DURATION_CHART,
        },
      },
    ],
    {staleTime: 0}
  );

  const getTimeSeries = useCallback(
    (field: string, color?: string): DiscoverSeries | undefined => {
      const series = data?.[field];
      if (!series || series.data.every(([_, [value]]) => value?.count === 0)) {
        return undefined;
      }

      return {
        data: series.data.map(([time, [value]]) => ({
          value: value?.count!,
          name: new Date(time * 1000).toISOString(),
        })),
        seriesName: field,
        meta: series.meta as EventsMetaType,
        color,
      } satisfies DiscoverSeries;
    },
    [data]
  );

  const plottables = useMemo(() => {
    const colors = theme.chart.getColorPalette(2);
    return [
      getTimeSeries('avg(span.duration)', colors[0]),
      getTimeSeries('p95(span.duration)', colors[1]),
    ]
      .filter(series => !!series)
      .map(ts => new Line(convertSeriesToTimeseries(ts)));
  }, [getTimeSeries, theme]);

  const isEmpty = plottables.every(plottable => plottable.isEmpty);

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        plottables,
        releases,
        showReleaseAs: 'bubble',
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Duration')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        !isEmpty && (
          <Toolbar
            exploreParams={{
              mode: Mode.SAMPLES,
              visualize: [
                {
                  chartType: ChartType.LINE,
                  yAxes: ['avg(span.duration)', 'p95(span.duration)'],
                },
              ],
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Duration'),
                children: <ModalChartContainer>{visualization}</ModalChartContainer>,
              });
            }}
          />
        )
      }
    />
  );
}
