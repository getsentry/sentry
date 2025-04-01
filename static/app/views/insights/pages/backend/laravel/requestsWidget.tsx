import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {ModalChartContainer} from 'sentry/views/insights/pages/backend/laravel/styles';
import {Toolbar} from 'sentry/views/insights/pages/backend/laravel/toolbar';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/backend/laravel/widgetVisualizationStates';

export function RequestsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({granularity: 'spans-low'});
  const theme = useTheme();

  const fullQuery = `span.op:http.server ${query}`.trim();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['trace_status_rate(internal_error)', 'count(span.duration)'],
          yAxis: ['trace_status_rate(internal_error)', 'count(span.duration)'],
          partial: 1,
          query: fullQuery,
          useRpc: 1,
        },
      },
    ],
    {staleTime: 0}
  );

  const statsToSeries = useCallback(
    (multiSeriesStats: MultiSeriesEventsStats | undefined, field: string): TimeSeries => {
      const stats = multiSeriesStats?.[field];
      const statsData = stats?.data || [];
      const meta = stats?.meta;

      return convertSeriesToTimeseries({
        data: statsData.map(([time], index) => ({
          name: new Date(time * 1000).toISOString(),
          value: statsData[index]?.[1][0]?.count! || 0,
        })),
        seriesName: field,
        meta: {
          fields: {
            [field]: meta?.fields[field]!,
          },
          units: {},
        },
      });
    },
    []
  );

  const plottables = useMemo(() => {
    return [
      new Bars(statsToSeries(data, 'count(span.duration)'), {
        alias: t('Requests'),
        color: theme.gray200,
      }),
      new Line(statsToSeries(data, 'trace_status_rate(internal_error)'), {
        alias: t('Error Rate'),
        color: theme.error,
      }),
    ];
  }, [data, statsToSeries, theme.error, theme.gray200]);

  const isEmpty = useMemo(
    () =>
      plottables.every(
        plottable =>
          plottable.isEmpty || plottable.timeSeries.data.every(point => !point.value)
      ),
    [plottables]
  );

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        plottables,
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Requests')} />}
      Visualization={visualization}
      Actions={
        !isEmpty && (
          <Toolbar
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: ['count(span.duration)'],
                },
              ],
              groupBy: ['trace.status'],
              sort: '-count(span.duration)',
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Requests'),
                children: <ModalChartContainer>{visualization}</ModalChartContainer>,
              });
            }}
          />
        )
      }
    />
  );
}
