import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ModelName} from 'sentry/views/insights/agents/components/modelName';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
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
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function LLMCallsWidget() {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const theme = useTheme();
  const fullQuery = useCombinedQuery(getAIGenerationsFilter());

  const generationsRequest = useSpans(
    {
      fields: ['gen_ai.request.model', 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
      search: fullQuery,
      limit: 3,
    },
    Referrer.LLM_CALLS_WIDGET
  );

  const timeSeriesRequest = useTopNSpanSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      fields: ['gen_ai.request.model', 'count(span.duration)'],
      yAxis: ['count(span.duration)'],
      sort: {field: 'count(span.duration)', kind: 'desc'},
      topN: 3,
      enabled: !!generationsRequest.data,
    },
    Referrer.LLM_CALLS_WIDGET
  );

  const timeSeries = timeSeriesRequest.data;

  const isLoading = timeSeriesRequest.isLoading || generationsRequest.isLoading;
  const error = timeSeriesRequest.error || generationsRequest.error;

  const models = generationsRequest.data;
  const hasData = models && models.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={tct(
            'No LLM calls found. Try updating your filters or learn more about AI Agents Insights in our [link:documentation].',
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
      {models?.map((item, index) => {
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
            <span>
              <Count value={item['count()'] ?? 0} />
            </span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('LLM Calls')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        hasData && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.LLM_CALLS_WIDGET}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: ['count(span.duration)'],
                },
              ],
              groupBy: ['gen_ai.request.model'],
              query: fullQuery,
              sort: `-count(span.duration)`,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('LLM Calls'),
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
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  min-width: 0px;
`;
