import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useCombinedQuery} from 'sentry/views/insights/agentMonitoring/hooks/useCombinedQuery';
import {
  AI_INPUT_TOKENS_ATTRIBUTE_SUM,
  AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM,
  AI_MODEL_ID_ATTRIBUTE,
  AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
  AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM,
  getAIGenerationsFilter,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
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

const SERIES_NAME_MAP: Record<string, string> = {
  [AI_INPUT_TOKENS_ATTRIBUTE_SUM]: 'Input Tokens',
  [AI_OUTPUT_TOKENS_ATTRIBUTE_SUM]: 'Output Tokens',
  [AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM]: 'Reasoning Tokens',
  [AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM]: 'Cached Tokens',
};

export default function TokenTypesWidget() {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const fullQuery = useCombinedQuery(getAIGenerationsFilter());

  const timeSeriesRequest = useSpanSeries(
    {
      ...pageFilterChartParams,
      search: fullQuery,
      yAxis: [
        AI_INPUT_TOKENS_ATTRIBUTE_SUM,
        AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM,
        AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
        AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM,
      ],
    },
    Referrer.TOKEN_TYPES_WIDGET
  );

  const timeSeries = timeSeriesRequest.data;

  const hasData = Object.keys(timeSeries).length > 0;

  const sums = Object.values(timeSeries).reduce(
    (acc, series) => {
      // @ts-expect-error fix this later
      acc[series.seriesName] += series.data.reduce(
        (acc2, point) => acc2 + point.value,
        0
      );
      return acc;
    },
    {
      [AI_INPUT_TOKENS_ATTRIBUTE_SUM]: 0,
      [AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM]: 0,
      [AI_OUTPUT_TOKENS_ATTRIBUTE_SUM]: 0,
      [AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM]: 0,
    }
  );

  // we need to deduct the reasoning tokens from the output tokens and cached tokens from the input tokens
  // then convert to percentages so all 4 types stack to 100%
  const timeSeriesAdjusted = useMemo(() => {
    if (!hasData) {
      return [];
    }

    // First, adjust the values by deducting overlapping tokens
    const adjustedSeries = Object.values(timeSeries).map(series => {
      if (series.seriesName === AI_INPUT_TOKENS_ATTRIBUTE_SUM) {
        return {
          ...series,
          data: series.data.map((point, index) => ({
            ...point,
            value:
              point.value -
              Number(
                timeSeries[AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM]?.data[index]?.value || 0
              ),
          })),
        };
      }

      if (series.seriesName === AI_OUTPUT_TOKENS_ATTRIBUTE_SUM) {
        return {
          ...series,
          data: series.data.map((point, index) => ({
            ...point,
            value:
              point.value -
              Number(
                timeSeries[AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM]?.data[index]
                  ?.value || 0
              ),
          })),
        };
      }

      return series;
    });

    // Calculate total tokens for each time point to convert to percentages
    const dataLength = adjustedSeries[0]?.data.length || 0;
    const totalsPerTimePoint = new Array(dataLength).fill(0);

    adjustedSeries.forEach(series => {
      series.data.forEach((point, index) => {
        totalsPerTimePoint[index] += point.value;
      });
    });

    // Convert to percentages
    return adjustedSeries.map(series => ({
      ...series,
      meta: {
        ...series.meta,
        fields: {
          ...series.meta?.fields,
          [AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM]: 'percentage',
          [AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM]: 'percentage',
          [AI_INPUT_TOKENS_ATTRIBUTE_SUM]: 'percentage',
          [AI_OUTPUT_TOKENS_ATTRIBUTE_SUM]: 'percentage',
        },
        units: {
          [AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM]: 'percentage',
          [AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM]: 'percentage',
          [AI_INPUT_TOKENS_ATTRIBUTE_SUM]: 'percentage',
          [AI_OUTPUT_TOKENS_ATTRIBUTE_SUM]: 'percentage',
        },
      },
      data: series.data.map((point, index) => ({
        ...point,
        value:
          totalsPerTimePoint[index] > 0 ? point.value / totalsPerTimePoint[index] : 0,
      })),
    }));
  }, [timeSeries, hasData]);

  const colorPalette = theme.chart.getColorPalette(3);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={timeSeriesRequest.isLoading}
      error={timeSeriesRequest.error}
      emptyMessage={
        <GenericWidgetEmptyStateWarning
          message={tct(
            'No token distribution found. Try updating your filters, or learn more about AI Agents Insights in our [link:documentation].',
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
        plottables: timeSeriesAdjusted.map(
          (ts, index) =>
            // @ts-expect-error fix this later
            new Area(convertSeriesToTimeseries(ts), {
              color: colorPalette[index],
              alias: `${SERIES_NAME_MAP[ts.seriesName]}`,
            })
        ),
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      <div>
        <SeriesColorIndicator
          style={{
            backgroundColor: colorPalette[0],
          }}
        />
      </div>
      <FooterText>{t('Input Tokens (Cached)')}</FooterText>
      <span>
        <TokenTypeCount
          value={Number(sums[AI_INPUT_TOKENS_ATTRIBUTE_SUM] || 0)}
          secondaryValue={Number(sums[AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM] || 0)}
        />
      </span>

      <div>
        <SeriesColorIndicator
          style={{
            backgroundColor: colorPalette[2],
          }}
        />
      </div>
      <FooterText>{t('Output Tokens (Reasoning)')}</FooterText>
      <span>
        <TokenTypeCount
          value={Number(sums[AI_OUTPUT_TOKENS_ATTRIBUTE_SUM] || 0)}
          secondaryValue={Number(sums[AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM] || 0)}
        />
      </span>
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Token Types')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        timeSeries && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.TOKEN_TYPES_WIDGET}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: [
                    AI_INPUT_TOKENS_ATTRIBUTE_SUM,
                    AI_INPUT_TOKENS_CACHED_ATTRIBUTE_SUM,
                    AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
                    AI_OUTPUT_TOKENS_REASONING_ATTRIBUTE_SUM,
                  ],
                },
              ],
              groupBy: [AI_MODEL_ID_ATTRIBUTE],
              query: fullQuery,
              sort: `-${AI_INPUT_TOKENS_ATTRIBUTE_SUM}`,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Token Types'),
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

function TokenTypeCount({
  value,
  secondaryValue,
}: {
  secondaryValue: number;
  value: number;
}) {
  return (
    <TokenTypeCountWrapper>
      <Count value={value} />
      <span>
        (<Count value={secondaryValue} />)
      </span>
    </TokenTypeCountWrapper>
  );
}

const TokenTypeCountWrapper = styled('span')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  justify-content: flex-end;
`;

const FooterText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  min-width: 0px;
`;
