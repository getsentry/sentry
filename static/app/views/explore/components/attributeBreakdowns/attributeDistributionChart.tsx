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
import {
  Actions,
  useAttributeBreakdownsTooltip,
} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import type {AttributeDistribution} from './attributeDistributionContent';

const MAX_BAR_WIDTH = 20;
const HIGH_CARDINALITY_THRESHOLD = 20;
const AXIS_LABEL_FONT_SIZE = 12;
const TOOLTIP_MAX_VALUE_LENGTH = 300;
const MAX_CHART_SERIES_LENGTH = 40;

function calculatePopulationPercentage(
  values: AttributeDistribution[number]['values'],
  cohortTotal: number
): number {
  if (cohortTotal === 0) return 0;

  const populatedCount = values.reduce((acc, curr) => acc + Number(curr.value), 0);
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

function distributionToSeriesData(
  values: AttributeDistribution[number]['values'],
  cohortCount: number
): Array<{label: string; value: number}> {
  const seriesData = values.slice(0, MAX_CHART_SERIES_LENGTH).map(value => ({
    label: value.label,
    value: cohortCount === 0 ? 0 : (value.value / cohortCount) * 100,
  }));

  return seriesData;
}

export function Chart({
  attributeDistribution,
  theme,
  cohortCount,
}: {
  attributeDistribution: AttributeDistribution[number];
  cohortCount: number;
  theme: Theme;
}) {
  const chartRef = useRef<ReactEchartsRef>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const color = theme.chart.getColorPalette(0)?.[0];

  const seriesData = useMemo(
    () => distributionToSeriesData(attributeDistribution.values, cohortCount),
    [attributeDistribution.values, cohortCount]
  );

  const maxSeriesValue = useMemo(() => {
    if (seriesData.length === 0) {
      return 0;
    }
    return Math.max(...seriesData.map(value => value.value));
  }, [seriesData]);

  const populationPercentage = useMemo(
    () => calculatePopulationPercentage(attributeDistribution.values, cohortCount),
    [attributeDistribution.values, cohortCount]
  );

  const toolTipFormatter = useCallback((p: TooltipComponentFormatterCallbackParams) => {
    const data = Array.isArray(p) ? p[0]?.data : p.data;
    const pct = percentageFormatter(Number(data));

    const value = Array.isArray(p) ? p[0]?.name : p.name;
    const truncatedValue = value
      ? value.length > TOOLTIP_MAX_VALUE_LENGTH
        ? `${value.slice(0, TOOLTIP_MAX_VALUE_LENGTH)}...`
        : value
      : '\u2014';
    const escapedTruncatedValue = escape(truncatedValue);
    return `
      <div class="tooltip-series" style="padding: 0;">
        <div
          class="tooltip-label"
          style="
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin: 0 auto;
            padding: 10px;
            min-width: 100px;
            max-width: 300px;
          "
        >
          <strong
            style="
              word-break: break-word;
              white-space: normal;
              overflow-wrap: anywhere;
            "
          >${escapedTruncatedValue}</strong>
          <span>${pct}</span>
        </div>
      </div>
    `.trim();
  }, []);

  const tooltipActionsHtmlRenderer = useCallback(
    (value: string) => {
      if (!value) return '';

      const escapedAttributeName = escape(attributeDistribution.name);
      const escapedValue = escape(value);
      const actionBackground = theme.gray200;
      return [
        '<div',
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
    [theme.gray200, attributeDistribution.name]
  );

  const tooltipConfig = useAttributeBreakdownsTooltip({
    chartRef,
    formatter: toolTipFormatter,
    chartWidth,
    actionsHtmlRenderer: tooltipActionsHtmlRenderer,
  });

  const chartXAxisLabelFormatter = useCallback(
    (value: string): string => {
      const labelsCount = seriesData.length > 0 ? seriesData.length : 1;

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
        <Tooltip title={attributeDistribution.name} showOnlyOnOverflow skipWrapper>
          <ChartTitle>{attributeDistribution.name}</ChartTitle>
        </Tooltip>
        <Flex gap="sm">
          <PopulationIndicator color={color}>
            <Tooltip
              showUnderline
              title={tct(
                '[percent] of spans in your query have this attribute populated',
                {
                  percent: percentageFormatter(populationPercentage),
                }
              )}
            >
              {percentageFormatter(populationPercentage)}
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
          data: seriesData.map(value => value.label),
          truncate: 14,
          axisLabel:
            seriesData.length > HIGH_CARDINALITY_THRESHOLD
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
            data: seriesData.map(value => value.value),
            itemStyle: {
              color,
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
