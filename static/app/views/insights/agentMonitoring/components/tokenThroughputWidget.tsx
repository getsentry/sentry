import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useCombinedQuery} from 'sentry/views/insights/agentMonitoring/hooks/useCombinedQuery';
import {
  AI_MODEL_ID_ATTRIBUTE,
  AI_TOKEN_USAGE_ATTRIBUTE_SUM,
  getAIGenerationsFilter,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function TokenThroughputWidget() {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const fullQuery = useCombinedQuery(getAIGenerationsFilter());

  const {isLoading, error, data} = useSpanSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      yAxis: [
        `avg(tags[gen_ai.response.tokens_per_second,number])`,
        `p95(tags[gen_ai.response.tokens_per_second,number])`,
      ],
    },
    Referrer.TOKEN_USAGE_WIDGET
  );

  const avg = data[`avg(tags[gen_ai.response.tokens_per_second,number])`];
  const p95 = data[`p95(tags[gen_ai.response.tokens_per_second,number])`];
  const timeSeries = [avg, p95];

  const colorPalette = theme.chart.getColorPalette(2);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!timeSeries.some(ts => ts)}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={tct(
            'No token usage found. Try updating your filters, or learn more about AI Agents Insights in our [link:documentation].',
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
        showLegend: 'always',
        plottables: [
          new Line(convertSeriesToTimeseries(avg), {
            alias: t('avg(tokens/s)'),
            color: colorPalette[0],
          }),
          new Line(convertSeriesToTimeseries(p95), {
            alias: t('p95(tokens/s)'),
            color: colorPalette[1],
          }),
        ],
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Token Throughput')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        timeSeries && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.TOKEN_USAGE_WIDGET}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: [AI_TOKEN_USAGE_ATTRIBUTE_SUM],
                },
              ],
              groupBy: [AI_MODEL_ID_ATTRIBUTE],
              query: fullQuery,
              sort: `-${AI_TOKEN_USAGE_ATTRIBUTE_SUM}`,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Token Usage'),
                children: (
                  <Fragment>
                    <ModalChartContainer>{visualization}</ModalChartContainer>
                  </Fragment>
                ),
              });
            }}
          />
        )
      }
      noFooterPadding
    />
  );
}
