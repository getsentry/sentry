import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import Count from 'sentry/components/count';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useCombinedQuery} from 'sentry/views/insights/agentMonitoring/hooks/useCombinedQuery';
import {
  AI_TOOL_NAME_ATTRIBUTE,
  getAIToolCallsFilter,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanEAPSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function ToolUsageWidget() {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const theme = useTheme();

  const fullQuery = useCombinedQuery(getAIToolCallsFilter());

  const toolsRequest = useEAPSpans(
    {
      fields: [AI_TOOL_NAME_ATTRIBUTE, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
      search: fullQuery,
      limit: 3,
    },
    Referrer.TOOL_USAGE_WIDGET
  );

  const timeSeriesRequest = useTopNSpanEAPSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      fields: [AI_TOOL_NAME_ATTRIBUTE, 'count(span.duration)'],
      yAxis: ['count(span.duration)'],
      sort: {field: 'count(span.duration)', kind: 'desc'},
      topN: 3,
      enabled: !!toolsRequest.data,
    },
    Referrer.TOOL_USAGE_WIDGET
  );

  const timeSeries = timeSeriesRequest.data;

  const isLoading = timeSeriesRequest.isLoading || toolsRequest.isLoading;
  const error = timeSeriesRequest.error || toolsRequest.error;

  // TODO(telex): Add tool name attribute to Fields and get rid of this cast
  const tools = toolsRequest.data as unknown as Array<Record<string, string | number>>;

  const hasData = tools && tools.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={tct(
            'No tool usage found. Try updating your filters, or learn more about AI Agents Insights in our [link:documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/insights/agents/" />
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
            new Bars(convertSeriesToTimeseries(ts), {
              color:
                ts.seriesName === 'Other' ? theme.chart.neutral : colorPalette[index],
              alias: ts.seriesName, // Ensures that the tooltip shows the full series name
              stack: 'stack',
            })
        ),
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {tools.map((item, index) => (
        <Fragment key={item[AI_TOOL_NAME_ATTRIBUTE]}>
          <div>
            <SeriesColorIndicator
              style={{
                backgroundColor: colorPalette[index],
              }}
            />
          </div>
          <div>
            <ToolText>{item[AI_TOOL_NAME_ATTRIBUTE]}</ToolText>
          </div>
          <span>
            <Count value={item['count()'] ?? 0} />
          </span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Tool Usage')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        hasData && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.TOOL_USAGE_WIDGET}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: ['count(span.duration)'],
                },
              ],
              groupBy: [AI_TOOL_NAME_ATTRIBUTE],
              query: fullQuery,
              sort: `-count(span.duration)`,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Tool Usage'),
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

const ToolText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  min-width: 0px;
`;
