import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import BaseChart from 'sentry/components/charts/baseChart';
import {Flex} from 'sentry/components/core/layout';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {escape} from 'sentry/utils';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {
  Actions,
  useAttributeBreakdownsTooltip,
} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

const MAX_BAR_WIDTH = 20;
const HIGH_CARDINALITY_THRESHOLD = 20;
const AXIS_LABEL_FONT_SIZE = 12;
const TOOLTIP_MAX_VALUE_LENGTH = 300;
const MAX_CHART_SERIES_LENGTH = 40;

const SELECTED_SERIES_NAME = 'selected';
const BASELINE_SERIES_NAME = 'baseline';

type CohortData = AttributeBreakdownsComparison['rankedAttributes'][number]['cohort1'];

function calculatePopulationPercentage(cohort: CohortData, cohortTotal: number): number {
  if (cohortTotal === 0) return 0;

  const populatedCount = cohort.reduce((acc, curr) => acc + Number(curr.value), 0);
  return (populatedCount / cohortTotal) * 100;
}

function percentageFormatter(percentage: number): string {
  if (isNaN(percentage) || !isFinite(percentage)) {
    return '\u2014';
  }

  if (percentage < 0.1 && percentage > 0) {
    return '<0.1%';
  }

  // Round whole numbers to 0 decimal places
  const decimals = percentage % 1 === 0 ? 0 : 1;
  return `${percentage.toFixed(decimals)}%`;
}

function cohortsToSeriesData(
  cohort1: CohortData,
  cohort2: CohortData,
  seriesTotals: {
    [BASELINE_SERIES_NAME]: number;
    [SELECTED_SERIES_NAME]: number;
  }
): {
  [BASELINE_SERIES_NAME]: Array<{label: string; value: number}>;
  [SELECTED_SERIES_NAME]: Array<{label: string; value: number}>;
} {
  const cohort1Map = new Map(cohort1.map(({label, value}) => [label, value]));
  const cohort2Map = new Map(cohort2.map(({label, value}) => [label, value]));

  const uniqueLabels = new Set([
    ...cohort1.map(c => c.label),
    ...cohort2.map(c => c.label),
  ]);

  // From the unique labels, we create two series data objects, one for the selected cohort and one for the baseline cohort.
  // If a label isn't present in either of the cohorts, we assign a value of 0, to that label in the respective series.
  const seriesData = Array.from(uniqueLabels).map(label => {
    const selectedVal = cohort1Map.get(label) ?? '0';
    const baselineVal = cohort2Map.get(label) ?? '0';

    // We sort by descending value of the selected cohort
    const selectedPercentage =
      seriesTotals[SELECTED_SERIES_NAME] === 0
        ? 0
        : (Number(selectedVal) / seriesTotals[SELECTED_SERIES_NAME]) * 100;
    const baselinePercentage =
      seriesTotals[BASELINE_SERIES_NAME] === 0
        ? 0
        : (Number(baselineVal) / seriesTotals[BASELINE_SERIES_NAME]) * 100;

    const sortVal = selectedPercentage;

    return {
      label,
      selectedValue: selectedPercentage,
      baselineValue: baselinePercentage,
      sortValue: sortVal,
    };
  });

  seriesData.sort((a, b) => b.sortValue - a.sortValue);

  const selectedSeriesData = seriesData
    .slice(0, MAX_CHART_SERIES_LENGTH)
    .map(({label, selectedValue}) => ({
      label,
      value: selectedValue,
    }));

  const baselineSeriesData = seriesData
    .slice(0, MAX_CHART_SERIES_LENGTH)
    .map(({label, baselineValue}) => ({
      label,
      value: baselineValue,
    }));

  return {
    [SELECTED_SERIES_NAME]: selectedSeriesData,
    [BASELINE_SERIES_NAME]: baselineSeriesData,
  };
}

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
  const cohort2Color = '#A29FAA';

  const seriesTotals = useMemo(
    () => ({
      [SELECTED_SERIES_NAME]: cohort1Total,
      [BASELINE_SERIES_NAME]: cohort2Total,
    }),
    [cohort1Total, cohort2Total]
  );

  const seriesData = useMemo(
    () => cohortsToSeriesData(attribute.cohort1, attribute.cohort2, seriesTotals),
    [attribute.cohort1, attribute.cohort2, seriesTotals]
  );

  const maxSeriesValue = useMemo(() => {
    const selectedSeries = seriesData[SELECTED_SERIES_NAME];
    const baselineSeries = seriesData[BASELINE_SERIES_NAME];

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
      selected: calculatePopulationPercentage(attribute.cohort1, cohort1Total),
      baseline: calculatePopulationPercentage(attribute.cohort2, cohort2Total),
    }),
    [attribute.cohort1, attribute.cohort2, cohort1Total, cohort2Total]
  );

  const toolTipFormatter = useCallback(
    (p: TooltipComponentFormatterCallbackParams) => {
      if (!Array.isArray(p)) {
        return '\u2014';
      }

      const selectedParam = p.find(s => s.seriesName === SELECTED_SERIES_NAME);
      const baselineParam = p.find(s => s.seriesName === BASELINE_SERIES_NAME);

      if (!selectedParam || !baselineParam) {
        throw new Error('selectedParam or baselineParam is not defined');
      }

      const selectedValue = selectedParam.value;
      const baselineValue = baselineParam.value;
      const selectedPct = percentageFormatter(Number(selectedValue));
      const baselinePct = percentageFormatter(Number(baselineValue));

      const name = selectedParam.name ?? baselineParam.name ?? '';
      const truncatedName =
        name.length > TOOLTIP_MAX_VALUE_LENGTH
          ? `${name.slice(0, TOOLTIP_MAX_VALUE_LENGTH)}...`
          : name;
      const escapedTruncatedName = escape(truncatedName);

      return `
      <div data-explore-chart-selection-region class="tooltip-series" style="padding: 0;">
        <div class="tooltip-label" style="display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin: 0 auto; padding: 10px; min-width: 100px; max-width: 300px;">
          <strong style="word-break: break-word; white-space: normal; overflow-wrap: anywhere; text-align: center;">${escapedTruncatedName}</strong>
          <span style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${cohort1Color}; display: inline-block;"></span>
              selected
            </span>
            <span>${selectedPct}</span>
          </span>
          <span style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${cohort2Color}; display: inline-block;"></span>
              baseline
            </span>
            <span>${baselinePct}</span>
          </span>
        </div>
      </div>
    `.trim();
    },
    [cohort1Color, cohort2Color]
  );

  const tooltipActionsHtmlRenderer = useCallback(
    (value: string) => {
      if (!value) return '';

      const escapedAttributeName = escape(attribute.attributeName);
      const escapedValue = escape(value);
      const actionBackground = theme.gray200;
      return [
        '<div',
        '  data-explore-chart-selection-region',
        '  class="tooltip-footer"',
        '  id="tooltipActions"',
        '  style="',
        '    display: flex;',
        '    justify-content: flex-start;',
        '    align-items: flex-start;',
        '    flex-direction: column;',
        '    padding: 0;',
        '    gap: 0;',
        '  "',
        '>',
        '  <div',
        `    data-tooltip-action="${Actions.GROUP_BY}"`,
        `    data-tooltip-action-key="${escapedAttributeName}"`,
        `    data-tooltip-action-value="${escapedValue}"`,
        '    style="width: 100%; padding: 8px 10px; cursor: pointer; text-align: left;"',
        `    onmouseover="this.style.background='${actionBackground}'"`,
        '    onmouseout="this.style.background=\'\'"',
        '  >',
        '    Group by attribute',
        '  </div>',
        '  <div',
        `    data-tooltip-action="${Actions.ADD_TO_FILTER}"`,
        `    data-tooltip-action-key="${escapedAttributeName}"`,
        `    data-tooltip-action-value="${escapedValue}"`,
        '    style="width: 100%; padding: 8px 10px; cursor: pointer; text-align: left;"',
        `    onmouseover="this.style.background='${actionBackground}'"`,
        '    onmouseout="this.style.background=\'\'"',
        '  >',
        '    Add value to filter',
        '  </div>',
        '  <div',
        `    data-tooltip-action="${Actions.EXCLUDE_FROM_FILTER}"`,
        `    data-tooltip-action-key="${escapedAttributeName}"`,
        `    data-tooltip-action-value="${escapedValue}"`,
        '    style="width: 100%; padding: 8px 10px; cursor: pointer; text-align: left;"',
        `    onmouseover="this.style.background='${actionBackground}'"`,
        '    onmouseout="this.style.background=\'\'"',
        '  >',
        '    Exclude value from filter',
        '  </div>',
        '  <div',
        `    data-tooltip-action="${Actions.COPY_TO_CLIPBOARD}"`,
        `    data-tooltip-action-key="${escapedAttributeName}"`,
        `    data-tooltip-action-value="${escapedValue}"`,
        '    style="width: 100%; padding: 8px 10px; cursor: pointer; text-align: left;"',
        `    onmouseover="this.style.background='${actionBackground}'"`,
        '    onmouseout="this.style.background=\'\'"',
        '  >',
        '    Copy value to clipboard',
        '  </div>',
        '</div>',
      ]
        .join('\n')
        .trim();
    },
    [theme.gray200, attribute.attributeName]
  );

  const tooltipConfig = useAttributeBreakdownsTooltip({
    chartRef,
    formatter: toolTipFormatter,
    chartWidth,
    actionsHtmlRenderer: tooltipActionsHtmlRenderer,
  });

  const chartXAxisLabelFormatter = useCallback(
    (value: string): string => {
      const selectedSeries = seriesData[SELECTED_SERIES_NAME];
      const labelsCount = selectedSeries.length > 0 ? selectedSeries.length : 1;
      // 14px is the width of the y axis label with font size 12
      // We'll subtract side padding (e.g. 4px per label) to avoid crowding
      const labelPadding = 4;
      const pixelsPerLabel = (chartWidth - 14) / labelsCount - labelPadding;

      //  Average width of a character is 0.6 times the font size
      const pixelsPerCharacter = 0.6 * AXIS_LABEL_FONT_SIZE;

      // Compute the max number of characters that can fit
      const maxChars = Math.floor(pixelsPerLabel / pixelsPerCharacter);

      // If value fits, return it as-is
      if (value.length <= maxChars) return value;

      // Otherwise, truncate and append '…'
      const truncatedLength = Math.max(1, maxChars - 2); // leaving space for (ellipsis)
      return value.slice(0, truncatedLength) + '…';
    },
    [chartWidth, seriesData]
  );

  useLayoutEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();

    if (!chartInstance) return;

    const width = chartInstance.getDom().offsetWidth;

    setChartWidth(width);
  }, [chartRef]);

  return (
    <ChartWrapper>
      <ChartHeaderWrapper justify="between" align="center" gap="lg">
        <Tooltip title={attribute.attributeName} showOnlyOnOverflow skipWrapper>
          <ChartTitle>{attribute.attributeName}</ChartTitle>
        </Tooltip>
        <Flex gap="sm">
          <PopulationIndicator color={cohort1Color}>
            <Tooltip
              showUnderline
              title={tct('[percent] of selected cohort has this attribute populated', {
                percent: percentageFormatter(populationPercentages.selected),
              })}
            >
              {percentageFormatter(populationPercentages.selected)}
            </Tooltip>
          </PopulationIndicator>
          <PopulationIndicator color={cohort2Color}>
            <Tooltip
              showUnderline
              title={tct('[percent] of baseline cohort has this attribute populated', {
                percent: percentageFormatter(populationPercentages.baseline),
              })}
            >
              {percentageFormatter(populationPercentages.baseline)}
            </Tooltip>
          </PopulationIndicator>
        </Flex>
      </ChartHeaderWrapper>
      <BaseChart
        ref={chartRef}
        autoHeightResize
        isGroupedByDate={false}
        tooltip={tooltipConfig}
        grid={{
          left: 2,
          right: 8,
          bottom: 40,
          containLabel: false,
        }}
        xAxis={{
          show: true,
          type: 'category',
          data: seriesData[SELECTED_SERIES_NAME].map(cohort => cohort.label),
          truncate: 14,
          axisLabel:
            seriesData[SELECTED_SERIES_NAME].length > HIGH_CARDINALITY_THRESHOLD
              ? {
                  show: false,
                }
              : {
                  hideOverlap: false,
                  showMaxLabel: false,
                  showMinLabel: false,
                  color: '#000',
                  interval: 0,
                  fontSize: AXIS_LABEL_FONT_SIZE,
                  formatter: chartXAxisLabelFormatter,
                },
        }}
        yAxis={{
          type: 'value',
          interval: maxSeriesValue < 1 ? 1 : undefined,
          axisLabel: {
            fontSize: 12,
            formatter: (value: number) => {
              return percentageFormatter(value);
            },
          },
        }}
        series={[
          {
            type: 'bar',
            data: seriesData[SELECTED_SERIES_NAME].map(cohort => cohort.value),
            name: SELECTED_SERIES_NAME,
            itemStyle: {
              color: cohort1Color,
            },
            barMaxWidth: MAX_BAR_WIDTH,
            animation: false,
          },
          {
            type: 'bar',
            data: seriesData[BASELINE_SERIES_NAME].map(cohort => cohort.value),
            name: BASELINE_SERIES_NAME,
            itemStyle: {
              color: cohort2Color,
            },
            barMaxWidth: MAX_BAR_WIDTH,
            animation: false,
          },
        ]}
      />
    </ChartWrapper>
  );
}

const ChartWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 200px;
  padding: ${space(1.5)} ${space(1.5)} 0 ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  overflow: hidden;
  min-width: 0;
`;

const ChartHeaderWrapper = styled(Flex)`
  margin-bottom: ${space(1)};
  max-width: 100%;
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.gray500};
  ${p => p.theme.overflowEllipsis};
`;

const PopulationIndicator = styled('div')<{color?: string}>`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  color: ${p => p.color || p.theme.gray400};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${p => p.color || p.theme.gray400};
    margin-right: ${space(0.5)};
  }
`;
