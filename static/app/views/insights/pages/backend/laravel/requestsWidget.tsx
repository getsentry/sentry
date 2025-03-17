import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
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
          field: ['trace.status', 'count(span.duration)'],
          yAxis: 'count(span.duration)',
          orderby: '-count(span.duration)',
          partial: 1,
          query: fullQuery,
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const combineTimeSeries = useCallback(
    (
      seriesData: EventsStats[],
      color: string,
      fieldName: string
    ): DiscoverSeries | undefined => {
      const firstSeries = seriesData[0];
      if (!firstSeries) {
        return undefined;
      }

      return {
        data: firstSeries.data.map(([time], index) => ({
          name: new Date(time * 1000).toISOString(),
          value: seriesData.reduce(
            (acc, series) => acc + series.data[index]?.[1][0]?.count!,
            0
          ),
        })),
        seriesName: fieldName,
        meta: {
          fields: {
            [fieldName]: 'integer',
          },
          units: {},
        },
        color,
      } satisfies DiscoverSeries;
    },
    []
  );

  const plottables = useMemo(() => {
    return [
      combineTimeSeries(
        [data?.ok].filter(series => !!series),
        theme.gray200,
        '2xx'
      ),
      combineTimeSeries(
        [data?.invalid_argument, data?.internal_error].filter(series => !!series),
        theme.error,
        '5xx'
      ),
    ]
      .filter(series => !!series)
      .map(
        series =>
          new Bars(convertSeriesToTimeseries(series), {
            color: series.color,
            stack: 'stack',
          })
      );
  }, [
    combineTimeSeries,
    data?.internal_error,
    data?.invalid_argument,
    data?.ok,
    theme.error,
    theme.gray200,
  ]);

  const isEmpty = plottables.every(plottable => plottable.isEmpty);

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
