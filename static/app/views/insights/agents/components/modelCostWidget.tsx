import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ModelName} from 'sentry/views/insights/agents/components/modelName';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
import {formatLLMCosts} from 'sentry/views/insights/agents/utils/formatLLMCosts';
import {getAIGenerationsFilter} from 'sentry/views/insights/agents/utils/query';
import {Referrer} from 'sentry/views/insights/agents/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
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
import {SpanFields} from 'sentry/views/insights/types';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function ModelCostWidget() {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const fullQuery = useCombinedQuery(getAIGenerationsFilter());

  const tokensRequest = useSpans(
    {
      fields: ['gen_ai.request.model', 'sum(gen_ai.usage.total_cost)'],
      sorts: [{field: 'sum(gen_ai.usage.total_cost)', kind: 'desc'}],
      search: fullQuery,
      limit: 3,
    },
    Referrer.MODEL_COST_WIDGET
  );

  const timeSeriesRequest = useTopNSpanSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      fields: [SpanFields.GEN_AI_REQUEST_MODEL, 'sum(gen_ai.usage.total_cost)'],
      yAxis: ['sum(gen_ai.usage.total_cost)'],
      sort: {field: 'sum(gen_ai.usage.total_cost)', kind: 'desc'},
      topN: 3,
      enabled: !!tokensRequest.data,
    },
    Referrer.MODEL_COST_WIDGET
  );

  const timeSeries = timeSeriesRequest.data;

  const isLoading = timeSeriesRequest.isLoading || tokensRequest.isLoading;
  const error = timeSeriesRequest.error || tokensRequest.error;

  const tokens = tokensRequest.data as unknown as
    | Array<Record<string, string | number>>
    | undefined;

  const hasData = tokens && tokens.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={tct(
            'No model cost found. Try updating your filters, or learn more about AI Agents Insights in our [link:documentation].',
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
      {tokens?.map((item, index) => {
        const modelId = `${item['gen_ai.request.model']}`;
        return (
          <Fragment key={modelId}>
            <div>
              <SeriesColorIndicator
                style={{
                  backgroundColor: colorPalette[index],
                }}
              />
            </div>
            <ModelText>
              <ModelName modelId={modelId} />
            </ModelText>
            <span>{formatLLMCosts(item['sum(gen_ai.usage.total_cost)'] || 0)}</span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Model Cost')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        timeSeries && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.MODEL_COST_WIDGET}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: ['sum(gen_ai.usage.total_cost)'],
                },
              ],
              groupBy: ['gen_ai.request.model'],
              query: fullQuery,
              sort: `-sum(gen_ai.usage.total_cost)`,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Model Cost'),
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

const ModelText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  min-width: 0px;
`;
