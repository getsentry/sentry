import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';

import {Button} from '@sentry/scraps/button/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import {openAttributeBreakdownViewerModal} from 'sentry/actionCreators/modal';
import {IconExpand} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {useAttributeBreakdownsTooltip} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import {
  CHART_BASELINE_SERIES_NAME,
  CHART_MAX_BAR_WIDTH,
  CHART_SELECTED_SERIES_NAME,
  COHORT_2_COLOR,
} from './constants';
import {AttributeBreakdownsComponent} from './styles';
import {useFormatComparisonModeTooltip} from './tooltips';
import {
  calculateAttributePopulationPercentage,
  cohortsToSeriesData,
  percentageFormatter,
  tooltipActionsHtmlRenderer,
} from './utils';

export function Chart({
  attribute,
  theme,
  cohort1Total,
  cohort2Total,
}: {
  attribute: AttributeBreakdownsComparison['rankedAttributes'][number];
  cohort1Total: number;
  cohort2Total: number;
  theme: Theme;
}) {
  const chartRef = useRef<ReactEchartsRef>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const cohort1Color = theme.chart.getColorPalette(0)?.[0];
  const cohort2Color = COHORT_2_COLOR;

  const seriesTotals = useMemo(
    () => ({
      [CHART_SELECTED_SERIES_NAME]: cohort1Total,
      [CHART_BASELINE_SERIES_NAME]: cohort2Total,
    }),
    [cohort1Total, cohort2Total]
  );

  const seriesData = useMemo(
    () => cohortsToSeriesData(attribute.cohort1, attribute.cohort2, seriesTotals),
    [attribute.cohort1, attribute.cohort2, seriesTotals]
  );

  const maxSeriesValue = useMemo(() => {
    const selectedSeries = seriesData[CHART_SELECTED_SERIES_NAME];
    const baselineSeries = seriesData[CHART_BASELINE_SERIES_NAME];

    if (selectedSeries.length === 0 && baselineSeries.length === 0) {
      return 0;
    }

    return Math.max(
      ...selectedSeries.map(cohort => cohort.value),
      ...baselineSeries.map(cohort => cohort.value)
    );
  }, [seriesData]);

  const populationPercentages = useMemo(
    () => ({
      selected: calculateAttributePopulationPercentage(attribute.cohort1, cohort1Total),
      baseline: calculateAttributePopulationPercentage(attribute.cohort2, cohort2Total),
    }),
    [attribute.cohort1, attribute.cohort2, cohort1Total, cohort2Total]
  );

  const formatComparisonModeTooltip = useFormatComparisonModeTooltip(
    cohort1Color,
    cohort2Color
  );
  const toolTipFormatter = useCallback(
    (p: Parameters<typeof formatComparisonModeTooltip>[0]) =>
      formatComparisonModeTooltip(p),
    [formatComparisonModeTooltip]
  );

  const actionsHtmlRenderer = useCallback(
    (value: string) => tooltipActionsHtmlRenderer(value, attribute.attributeName, theme),
    [attribute.attributeName, theme]
  );

  const tooltipConfig = useAttributeBreakdownsTooltip({
    chartRef,
    formatter: toolTipFormatter,
    chartWidth,
    actionsHtmlRenderer,
  });

  useLayoutEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();

    if (!chartInstance) return;

    const width = chartInstance.getDom().offsetWidth;

    setChartWidth(width);
  }, [chartRef]);

  return (
    <AttributeBreakdownsComponent.ChartWrapper>
      <AttributeBreakdownsComponent.ChartHeaderWrapper
        justify="between"
        align="center"
        gap="lg"
      >
        <Tooltip title={attribute.attributeName} showOnlyOnOverflow skipWrapper>
          <AttributeBreakdownsComponent.ChartTitle>
            {attribute.attributeName}
          </AttributeBreakdownsComponent.ChartTitle>
        </Tooltip>
        <Flex gap="sm" align="center">
          <AttributeBreakdownsComponent.PopulationIndicator color={cohort1Color}>
            <Tooltip
              showUnderline
              title={tct('[percent] of selected cohort has this attribute populated', {
                percent: percentageFormatter(populationPercentages.selected),
              })}
            >
              {percentageFormatter(populationPercentages.selected)}
            </Tooltip>
          </AttributeBreakdownsComponent.PopulationIndicator>
          <AttributeBreakdownsComponent.PopulationIndicator color={cohort2Color}>
            <Tooltip
              showUnderline
              title={tct('[percent] of baseline cohort has this attribute populated', {
                percent: percentageFormatter(populationPercentages.baseline),
              })}
            >
              {percentageFormatter(populationPercentages.baseline)}
            </Tooltip>
          </AttributeBreakdownsComponent.PopulationIndicator>
          <Button
            size="zero"
            priority="transparent"
            icon={<IconExpand size="xs" />}
            aria-label={t('Expand chart')}
            onClick={() =>
              openAttributeBreakdownViewerModal({
                mode: 'comparison',
                attribute,
                cohort1Total,
                cohort2Total,
              })
            }
          />
        </Flex>
      </AttributeBreakdownsComponent.ChartHeaderWrapper>
      <AttributeBreakdownsComponent.Chart
        chartRef={chartRef}
        chartWidth={chartWidth}
        xAxisData={seriesData[CHART_SELECTED_SERIES_NAME].map(cohort => cohort.label)}
        maxSeriesValue={maxSeriesValue}
        tooltip={tooltipConfig}
        series={[
          {
            type: 'bar',
            data: seriesData[CHART_SELECTED_SERIES_NAME].map(cohort => cohort.value),
            name: CHART_SELECTED_SERIES_NAME,
            itemStyle: {
              color: cohort1Color,
            },
            barMaxWidth: CHART_MAX_BAR_WIDTH,
            animation: false,
          },
          {
            type: 'bar',
            data: seriesData[CHART_BASELINE_SERIES_NAME].map(cohort => cohort.value),
            name: CHART_BASELINE_SERIES_NAME,
            itemStyle: {
              color: cohort2Color,
            },
            barMaxWidth: CHART_MAX_BAR_WIDTH,
            animation: false,
          },
        ]}
      />
    </AttributeBreakdownsComponent.ChartWrapper>
  );
}
