import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Link} from 'sentry/components/core/link';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanEAPSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
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

export default function OverviewSlowNextjsSSRWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const pageFilterChartParams = usePageFilterChartParams();
  const {query} = useTransactionNameQuery();

  const fullQuery = `span.op:function.nextjs ${query}`;

  const spansRequest = useEAPSpans(
    {
      search: fullQuery,
      fields: ['span.group', 'project.id', 'span.description', 'avg(span.duration)'],
      sorts: [{field: 'avg(span.duration)', kind: 'desc'}],
      limit: 4,
      pageFilters: props.pageFilters,
    },
    Referrer.SLOW_SSR_CHART
  );

  const timeSeriesRequest = useTopNSpanEAPSeries(
    {
      ...pageFilterChartParams,
      search: `span.group:[${spansRequest.data?.map(item => `"${item['span.group']}"`).join(',')}]`,
      fields: ['span.group', 'avg(span.duration)'],
      yAxis: ['avg(span.duration)'],
      sort: {field: 'avg(span.duration)', kind: 'desc'},
      topN: 4,
      enabled: !!spansRequest.data,
    },
    Referrer.SLOW_SSR_CHART,
    props.pageFilters
  );

  const timeSeries = timeSeriesRequest.data.filter(ts => ts.seriesName !== 'Other');

  const isLoading = timeSeriesRequest.isLoading || spansRequest.isLoading;
  const error = timeSeriesRequest.error || spansRequest.error;

  const hasData =
    spansRequest.data && spansRequest.data.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const aliases = Object.fromEntries(
    spansRequest.data?.map(item => [item['span.group'], item['span.description']]) ?? []
  );

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        ...props,
        id: 'overviewSlowNextjsSSRWidget',
        showLegend: 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Line(convertSeriesToTimeseries(ts), {
              color: colorPalette[index],
              alias: aliases[ts.seriesName],
            })
        ),
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {spansRequest.data?.map((item, index) => (
        <Fragment key={item['span.description']}>
          <div>
            <SeriesColorIndicator
              style={{
                backgroundColor: colorPalette[index],
              }}
            />
          </div>
          <div>
            <Link
              to={getExploreUrl({
                mode: Mode.SAMPLES,
                visualize: [
                  {
                    chartType: ChartType.BAR,
                    yAxes: ['count(span.duration)'],
                  },
                ],
                sort: '-count(span.duration)',
                query: `${fullQuery} span.description:"${item['span.description']}"`,
                interval: pageFilterChartParams.interval,
                organization,
                selection,
              })}
            >
              {item['span.description']}
            </Link>
          </div>
          <span>{getDuration((item['avg(span.duration)'] ?? 0) / 1000, 2, true)}</span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Slow SSR')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        hasData && (
          <Toolbar
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.LINE,
                  yAxes: ['avg(span.duration)'],
                },
              ],
              groupBy: ['span.description'],
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            loaderSource={props.loaderSource}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Slow SSR'),
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
      Footer={props.loaderSource === 'releases-drawer' ? undefined : footer}
    />
  );
}
