import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useEAPSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
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

  const {data, isLoading, error} = useEAPSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      yAxis: ['trace_status_rate(internal_error)', 'count(span.duration)'],
      referrer: Referrer.JOBS_CHART,
    },
    Referrer.JOBS_CHART,
    props.pageFilters
  );

  const plottables = useMemo(() => {
    return [
      new Bars(convertSeriesToTimeseries(data['count(span.duration)']), {
        alias: ALIASES['count(span.duration)'],
        color: theme.gray200,
      }),
      new Line(convertSeriesToTimeseries(data['trace_status_rate(internal_error)']), {
        alias: ALIASES['trace_status_rate(internal_error)'],
        color: theme.error,
      }),
    ];
  }, [data, theme.error, theme.gray200]);

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
        id: 'overviewJobsChartWidget',
        showLegend: 'never',
        plottables,
        ...props,
        ...releaseBubbleProps,
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
