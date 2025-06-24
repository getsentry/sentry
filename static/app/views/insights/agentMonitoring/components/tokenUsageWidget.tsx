import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ModelName} from 'sentry/views/insights/agentMonitoring/components/modelName';
import {
  AI_INPUT_TOKENS_ATTRIBUTE_SUM,
  AI_MODEL_ID_ATTRIBUTE,
  AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
  AI_TOKEN_USAGE_ATTRIBUTE_SUM,
  getAIGenerationsFilter,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanEAPSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {TimeSpentInDatabaseWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function TokenUsageWidget() {
  const theme = useTheme();
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const fullQuery = `${getAIGenerationsFilter()} ${query}`.trim();

  const tokensRequest = useEAPSpans(
    {
      fields: [
        AI_MODEL_ID_ATTRIBUTE,
        AI_TOKEN_USAGE_ATTRIBUTE_SUM,
        AI_INPUT_TOKENS_ATTRIBUTE_SUM,
        AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
      ],
      sorts: [{field: AI_TOKEN_USAGE_ATTRIBUTE_SUM, kind: 'desc'}],
      search: fullQuery,
      limit: 3,
    },
    Referrer.QUERIES_CHART // TODO: add referrer
  );

  const timeSeriesRequest = useTopNSpanEAPSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      fields: [
        AI_MODEL_ID_ATTRIBUTE,
        AI_TOKEN_USAGE_ATTRIBUTE_SUM,
        AI_INPUT_TOKENS_ATTRIBUTE_SUM,
        AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
      ],
      yAxis: [AI_INPUT_TOKENS_ATTRIBUTE_SUM],
      sort: {field: AI_INPUT_TOKENS_ATTRIBUTE_SUM, kind: 'desc'},
      topN: 3,
      enabled: !!tokensRequest.data,
    },
    Referrer.QUERIES_CHART // TODO: add referrer
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
      emptyMessage={<TimeSpentInDatabaseWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        showLegend: 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Bars(convertSeriesToTimeseries(ts), {
              color: ts.seriesName === 'Other' ? theme.gray200 : colorPalette[index],
              alias: ts.seriesName,
              stack: 'stack',
            })
        ),
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {tokens?.map((item, index) => {
        const modelId = `${item[AI_MODEL_ID_ATTRIBUTE]}`;
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
              {formatAbbreviatedNumber(
                Number(item[AI_INPUT_TOKENS_ATTRIBUTE_SUM] || 0) +
                  Number(item[AI_OUTPUT_TOKENS_ATTRIBUTE_SUM] || 0)
              )}
            </span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Token Usage')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        timeSeries && (
          <Toolbar
            showCreateAlert
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
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  min-width: 0px;
`;
