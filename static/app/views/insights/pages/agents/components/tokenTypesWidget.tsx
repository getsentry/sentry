import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {getAIGenerationsFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
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
  'sum(gen_ai.usage.input_tokens)': 'Input Tokens',
  'sum(gen_ai.usage.output_tokens)': 'Output Tokens',
  'sum(gen_ai.usage.output_tokens.reasoning)': 'Reasoning Tokens',
  'sum(gen_ai.usage.input_tokens.cached)': 'Cached Tokens',
};

export default function TokenTypesWidget() {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });

  const fullQuery = useCombinedQuery(getAIGenerationsFilter());

  const {data, error, isLoading} = useFetchSpanTimeSeries(
    {
      ...pageFilterChartParams,
      query: fullQuery,
      yAxis: [
        'sum(gen_ai.usage.input_tokens)',
        'sum(gen_ai.usage.input_tokens.cached)',
        'sum(gen_ai.usage.output_tokens)',
        'sum(gen_ai.usage.output_tokens.reasoning)',
      ],
    },
    Referrer.TOKEN_TYPES_WIDGET
  );

  const hasData = (data?.timeSeries?.length ?? 0) > 0;

  const sums = (data?.timeSeries ?? []).reduce(
    (acc, series) => {
      acc[series.yAxis as keyof typeof acc] += series.values.reduce(
        (acc2, point) => acc2 + (point.value || 0),
        0
      );
      return acc;
    },
    {
      'sum(gen_ai.usage.input_tokens)': 0,
      'sum(gen_ai.usage.input_tokens.cached)': 0,
      'sum(gen_ai.usage.output_tokens)': 0,
      'sum(gen_ai.usage.output_tokens.reasoning)': 0,
    }
  );

  // we need to deduct the reasoning tokens from the output tokens and cached tokens from the input tokens
  // then convert to percentages so all 4 types stack to 100%
  const timeSeriesAdjusted: TimeSeries[] = useMemo(() => {
    if (!data) {
      return [];
    }

    const adjustedSeries = data.timeSeries.map(series => {
      if (series.yAxis === 'sum(gen_ai.usage.input_tokens)') {
        const cachedSeries = data.timeSeries.find(
          s => s.yAxis === 'sum(gen_ai.usage.input_tokens.cached)'
        );

        return {
          ...series,
          values: series.values.map((point, index) => ({
            ...point,
            value: (point.value || 0) - Number(cachedSeries?.values[index]?.value || 0),
          })),
        };
      }

      if (series.yAxis === 'sum(gen_ai.usage.output_tokens)') {
        const reasoningSeries = data.timeSeries.find(
          s => s.yAxis === 'sum(gen_ai.usage.output_tokens.reasoning)'
        );

        return {
          ...series,
          values: series.values.map((point, index) => ({
            ...point,
            value:
              (point.value || 0) - Number(reasoningSeries?.values[index]?.value || 0),
          })),
        };
      }

      return series;
    });

    // Calculate total tokens for each time point to convert to percentages
    const dataLength = adjustedSeries[0]?.values.length || 0;
    const totalsPerTimePoint = new Array(dataLength).fill(0);

    adjustedSeries.forEach(series => {
      series.values.forEach((point, index) => {
        totalsPerTimePoint[index] += point.value || 0;
      });
    });

    // Convert to percentages
    return adjustedSeries.map(series => ({
      ...series,
      meta: {
        ...series.meta,
        valueType: 'percentage',
        valueUnit: null,
      },
      values: series.values.map((point, index) => ({
        ...point,
        value:
          totalsPerTimePoint[index] > 0
            ? (point.value || 0) / totalsPerTimePoint[index]
            : 0,
      })),
    }));
  }, [data]);

  // DEBUG: Check for negative values
  timeSeriesAdjusted.forEach(series => {
    series.values.forEach((point, index) => {
      if ((point.value || 0) < 0) {
        Sentry.captureMessage(
          `Negative value found in ${series.yAxis} at index ${index}: ${point.value}`
        );
      }
    });
  });

  const colorPalette = theme.chart.getColorPalette(3);

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
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
            new Area(ts, {
              color: colorPalette[index],
              alias: `${SERIES_NAME_MAP[ts.yAxis]}`,
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
      <FooterText>{t('Input Tokens / Cached')}</FooterText>
      <span>
        <TokenTypeCount
          value={Number(sums['sum(gen_ai.usage.input_tokens)'] || 0)}
          secondaryValue={Number(sums['sum(gen_ai.usage.input_tokens.cached)'] || 0)}
        />
      </span>

      <div>
        <SeriesColorIndicator
          style={{
            backgroundColor: colorPalette[2],
          }}
        />
      </div>
      <FooterText>{t('Output Tokens / Reasoning')}</FooterText>
      <span>
        <TokenTypeCount
          value={Number(sums['sum(gen_ai.usage.output_tokens)'] || 0)}
          secondaryValue={Number(sums['sum(gen_ai.usage.output_tokens.reasoning)'] || 0)}
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
        hasData && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.TOKEN_TYPES_WIDGET}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: [
                    'sum(gen_ai.usage.input_tokens)',
                    'sum(gen_ai.usage.input_tokens.cached)',
                    'sum(gen_ai.usage.output_tokens)',
                    'sum(gen_ai.usage.output_tokens.reasoning)',
                  ],
                },
              ],
              query: fullQuery,
              sort: `-sum(gen_ai.usage.input_tokens)`,
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
      /
      <Count value={secondaryValue} />
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
