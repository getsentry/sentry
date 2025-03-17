import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/backend/laravel/styles';
import {Toolbar} from 'sentry/views/insights/pages/backend/laravel/toolbar';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/backend/laravel/widgetVisualizationStates';

const seriesAliases = {
  ok: t('Processed'),
  internal_error: t('Failed'),
};

function createEmptySeries(color: string, seriesName: string): DiscoverSeries {
  return {
    data: [],
    seriesName,
    meta: {
      fields: {
        [seriesName]: 'integer',
      },
      units: {},
    },
    color,
  };
}

export function JobsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });
  const theme = useTheme();

  const fullQuery = `span.op:queue.process ${query}`.trim();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['trace.status', 'count(span.duration)'],
          yAxis: ['count(span.duration)'],
          transformAliasToInputFormat: 1,
          query: fullQuery,
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const statsToSeries = useCallback(
    (stats: EventsStats | undefined, name: string, color: string): DiscoverSeries => {
      if (!stats) {
        return createEmptySeries(color, name);
      }

      return {
        data: stats.data.map(([time], index) => ({
          name: new Date(time * 1000).toISOString(),
          value: stats.data[index]?.[1][0]?.count! || 0,
        })),
        seriesName: name,
        meta: {
          fields: {
            [name]: 'integer',
          },
          units: {},
        },
        color,
      };
    },
    []
  );

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!data) {
      return [];
    }

    const okJobs = statsToSeries(data.ok, 'ok', theme.gray200);
    const failedJobs = statsToSeries(data.internal_error, 'internal_error', theme.error);
    return [okJobs, failedJobs].filter(series => !!series);
  }, [data, statsToSeries, theme.error, theme.gray200]);

  const plottables = useMemo(() => {
    return timeSeries.map(
      ts =>
        new Bars(convertSeriesToTimeseries(ts), {
          color: ts.color,
          stack: 'stack',
          alias: seriesAliases[ts.seriesName as 'ok' | 'internal_error'],
        })
    );
  }, [timeSeries]);

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

  const footer = !isEmpty && (
    <WidgetFooterTable>
      {timeSeries.map(series => {
        const total = series.data.reduce((sum, point) => sum + point.value, 0);
        return (
          <Fragment key={series.seriesName}>
            <div>
              <SeriesColorIndicator
                style={{
                  backgroundColor: series.color,
                }}
              />
            </div>
            <div>{seriesAliases[series.seriesName as keyof typeof seriesAliases]}</div>
            <span>{formatAbbreviatedNumber(total)}</span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Jobs')} />}
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
              field: ['count(span.duration)'],
              query: fullQuery,
              sort: '-count(span.duration)',
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Jobs'),
                children: (
                  <Fragment>
                    <ModalChartContainer>{visualization}</ModalChartContainer>
                    <ModalTableWrapper>{footer}</ModalTableWrapper>
                  </Fragment>
                ),
              });
            }}
          />
        )
      }
      noFooterPadding
      Footer={footer}
    />
  );
}
