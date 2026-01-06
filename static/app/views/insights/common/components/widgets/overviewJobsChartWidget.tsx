import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {QueuesWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const ALIASES = {
  'count(span.duration)': t('Jobs'),
  'trace_status_rate(internal_error)': t('Error Rate'),
};

export default function OverviewJobsChartWidget(props: LoadableChartWidgetProps) {
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
    ...props.pageFilters,
  });
  const theme = useTheme();

  const fullQuery = `span.op:queue.process ${query}`.trim();

  const {data, isLoading, error} = useFetchSpanTimeSeries(
    {
      ...pageFilterChartParams,
      query: fullQuery,
      yAxis: ['trace_status_rate(internal_error)', 'count(span.duration)'],
      pageFilters: props.pageFilters,
    },
    Referrer.JOBS_CHART
  );

  const countPlottable = useMemo(() => {
    const timeSeries = data?.timeSeries || [];
    const countSeries = timeSeries.find(ts => ts.yAxis === 'count(span.duration)');

    return (
      countSeries &&
      new Bars(countSeries, {
        alias: ALIASES['count(span.duration)'],
        color: theme.chart.neutral,
      })
    );
  }, [data, theme.chart.neutral]);

  const errorRatePlottable = useMemo(() => {
    const timeSeries = data?.timeSeries || [];

    const errorRateSeries = timeSeries.find(
      ts => ts.yAxis === 'trace_status_rate(internal_error)'
    );

    return (
      errorRateSeries &&
      new Line(errorRateSeries, {
        alias: ALIASES['trace_status_rate(internal_error)'],
        color: theme.error,
      })
    );
  }, [data, theme.error]);

  const isEmpty = useMemo(
    () =>
      [countPlottable, errorRatePlottable]
        .filter(defined)
        .every(
          plottable =>
            plottable.isEmpty || plottable.timeSeries.values.every(point => !point.value)
        ),
    [countPlottable, errorRatePlottable]
  );

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage={<QueuesWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewJobsChartWidget',
        showLegend: 'never',
        plottables: [countPlottable, errorRatePlottable].filter(defined),
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  const {totalJobs, overallErrorRate} = useMemo(() => {
    const errorCounts = errorRatePlottable?.timeSeries.values;
    const jobCounts = countPlottable?.timeSeries.values;

    if (!errorCounts || !jobCounts) {
      return {totalJobs: 0, overallErrorRate: 0};
    }

    let jobsCount = 0;
    let errorCount = 0;

    errorCounts?.forEach((item, i) => {
      const count = jobCounts[i]?.value!;
      jobsCount += count;
      errorCount += item.value! * count;
    });

    return {totalJobs: jobsCount, overallErrorRate: errorCount / jobsCount};
  }, [countPlottable, errorRatePlottable]);

  const footer = !isEmpty && (
    <WidgetFooterTable>
      <Fragment>
        <div>
          <SeriesColorIndicator
            style={{
              backgroundColor: theme.colors.gray200,
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
            showCreateAlert
            aliases={ALIASES}
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
            loaderSource={props.loaderSource}
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
