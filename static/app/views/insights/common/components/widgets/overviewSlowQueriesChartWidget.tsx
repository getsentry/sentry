import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
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
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {TimeSpentInDatabaseWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function OverviewSlowQueriesChartWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const pageFilterChartParams = usePageFilterChartParams(props);

  const fullQuery = `has:db.system has:span.group ${query}`;

  const queriesRequest = useSpans(
    {
      fields: [
        'span.op',
        'span.group',
        'project.id',
        'sentry.normalized_description',
        'avg(span.duration)',
        'transaction',
      ],
      sorts: [{field: 'avg(span.duration)', kind: 'desc'}],
      search: fullQuery,
      limit: 3,
      pageFilters: props.pageFilters,
    },
    Referrer.QUERIES_CHART
  );

  const timeSeriesRequest = useFetchSpanTimeSeries(
    {
      ...pageFilterChartParams,
      query: `span.group:[${queriesRequest.data?.map(item => `"${item['span.group']}"`).join(',')}]`,
      groupBy: [SpanFields.TRANSACTION, SpanFields.SPAN_GROUP],
      yAxis: ['avg(span.duration)'],
      sort: {field: 'avg(span.duration)', kind: 'desc'},
      topEvents: 3,
      excludeOther: true,
      enabled: queriesRequest.data.length > 0,
      pageFilters: props.pageFilters,
    },
    Referrer.QUERIES_CHART
  );

  const timeSeries = timeSeriesRequest.data?.timeSeries ?? [];

  const isLoading = timeSeriesRequest.isLoading || queriesRequest.isLoading;
  const error = timeSeriesRequest.error || queriesRequest.error;

  const hasData =
    queriesRequest.data && queriesRequest.data.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={<TimeSpentInDatabaseWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewSlowQueriesChartWidget',
        showLegend: props.loaderSource === 'releases-drawer' ? 'auto' : 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Line(ts, {
              color: colorPalette[index],
            })
        ),
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {queriesRequest.data?.map((item, index) => (
        <Fragment
          key={`${item['project.id']}-${item['span.group']}-${item['sentry.normalized_description']}`}
        >
          <div>
            <SeriesColorIndicator
              style={{
                backgroundColor: colorPalette[index],
              }}
            />
          </div>
          <div>
            <SpanDescriptionCell
              projectId={Number(item['project.id'])}
              group={item['span.group']}
              description={item['sentry.normalized_description']}
              moduleName={ModuleName.DB}
            />
            <ControllerText>{item.transaction}</ControllerText>
          </div>
          <span>{getDuration((item['avg(span.duration)'] ?? 0) / 1000, 2, true)}</span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Slow Queries')} />}
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
              groupBy: ['sentry.normalized_description'],
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            loaderSource={props.loaderSource}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Slow Queries'),
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

const ControllerText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  min-width: 0px;
`;
