import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import type {SpanStringFields} from 'sentry/views/insights/types';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

interface GroupedDurationWidgetProps {
  groupBy: SpanStringFields;
  query: string;
  referrer: string;
  title: string;
}

export default function GroupedDurationWidget(props: GroupedDurationWidgetProps) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const theme = useTheme();
  const fullQuery = useCombinedQuery(props.query);

  const topEventsRequest = useSpans(
    {
      fields: [props.groupBy, 'avg(span.duration)'],
      sorts: [{field: 'avg(span.duration)', kind: 'desc'}],
      search: fullQuery,
      limit: 3,
    },
    props.referrer
  );

  const timeSeriesRequest = useFetchSpanTimeSeries(
    {
      ...pageFilterChartParams,
      query: fullQuery,
      groupBy: [props.groupBy],
      yAxis: ['avg(span.duration)'],
      sort: {field: 'avg(span.duration)', kind: 'desc'},
      topEvents: 3,
      enabled: !!topEventsRequest.data && topEventsRequest.data.length > 0,
    },
    props.referrer
  );

  const timeSeries = timeSeriesRequest.data?.timeSeries || [];

  const isLoading = timeSeriesRequest.isLoading || topEventsRequest.isLoading;
  const error = timeSeriesRequest.error || topEventsRequest.error;

  const events = topEventsRequest.data;

  const hasData = events && events.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={tct(
            'No MCP spans found. Try updating your filters or learn more about MCP monitoring in our [link:documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/insights/ai/mcp/" />
              ),
            }
          )}
        />
      }
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        showLegend: 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Line(ts, {
              color: ts.meta.isOther ? theme.chartOther : colorPalette[index],
            })
        ),
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {events?.map((item, index) => {
        const groupName = item[props.groupBy] ?? t('Other');
        return (
          <Fragment key={groupName}>
            <div>
              <SeriesColorIndicator
                style={{
                  backgroundColor: colorPalette[index],
                }}
              />
            </div>
            <div>{groupName}</div>
            <span>{getDuration((item['avg(span.duration)'] ?? 0) / 1000, 2, true)}</span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={props.title} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        hasData && (
          <Toolbar
            showCreateAlert
            referrer={props.referrer}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.LINE,
                  yAxes: ['avg(span.duration)'],
                },
              ],
              groupBy: [props.groupBy],
              query: fullQuery,
              sort: `-avg(span.duration)`,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: props.title,
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
