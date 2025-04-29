import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {Release, TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/laravel/styles';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {QueuesWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export function JobsWidget({query, releases}: {query?: string; releases?: Release[]}) {
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
          field: ['trace_status_rate(internal_error)', 'count(span.duration)'],
          yAxis: ['trace_status_rate(internal_error)', 'count(span.duration)'],
          transformAliasToInputFormat: 1,
          query: fullQuery,
          useRpc: 1,
          referrer: Referrer.JOBS_CHART,
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
        alias: t('Jobs'),
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
          plottable.isEmpty || plottable.timeSeries.values.every(point => !point.value)
      ),
    [plottables]
  );

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage={<QueuesWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        showLegend: 'never',
        plottables,
        releases,
        showReleaseAs: 'bubble',
      }}
    />
  );

  const {totalJobs, overallErrorRate} = useMemo(() => {
    const errorSeries = plottables[1]!.timeSeries;
    const jobCounts = plottables[0]!.timeSeries.values;
    let jobsCount = 0;
    let errorCount = 0;
    errorSeries.values.forEach((point, i) => {
      const count = jobCounts[i]?.value!;
      jobsCount += count;
      errorCount += point.value! * count;
    });

    return {totalJobs: jobsCount, overallErrorRate: errorCount / jobsCount};
  }, [plottables]);

  const footer = !isEmpty && (
    <WidgetFooterTable>
      <Fragment>
        <div>
          <SeriesColorIndicator
            style={{
              backgroundColor: theme.gray200,
            }}
          />
        </div>
        <div>{t('Jobs')}</div>
        <span>{formatAbbreviatedNumber(totalJobs)}</span>
      </Fragment>
      <Fragment>
        <div>
          <SeriesColorIndicator
            style={{
              backgroundColor: theme.error,
            }}
          />
        </div>
        <div>{t('Error Rate')}</div>
        <span>{(overallErrorRate * 100).toFixed(2)}%</span>
      </Fragment>
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Jobs')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
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
