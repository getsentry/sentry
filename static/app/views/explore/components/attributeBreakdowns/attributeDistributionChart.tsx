import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import BaseChart from 'sentry/components/charts/baseChart';
import {Flex} from 'sentry/components/core/layout';
import {tct} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {useAttributeBreakdownsTooltip} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import type {AttributeDistribution} from './attributeDistributionContent';
import {
  CHART_AXIS_LABEL_FONT_SIZE,
  CHART_HIGH_CARDINALITY_THRESHOLD,
  CHART_MAX_BAR_WIDTH,
  CHART_MAX_SERIES_LENGTH,
  CHART_TOOLTIP_MAX_VALUE_LENGTH,
} from './constants';
import {AttributeBreakdownsComponent} from './styles';
import {
  calculateAttrubutePopulationPercentage,
  formatChartXAxisLabel,
  percentageFormatter,
  tooltipActionsHtmlRenderer,
} from './utils';

function distributionToSeriesData(
  values: AttributeDistribution[number]['values'],
  cohortCount: number
): Array<{label: string; value: number}> {
  const seriesData = values.slice(0, CHART_MAX_SERIES_LENGTH).map(value => ({
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
    () =>
      calculateAttrubutePopulationPercentage(attributeDistribution.values, cohortCount),
    [attributeDistribution.values, cohortCount]
  );

  const toolTipFormatter = useCallback((p: TooltipComponentFormatterCallbackParams) => {
    const data = Array.isArray(p) ? p[0]?.data : p.data;
    const pct = percentageFormatter(Number(data));

    const value = Array.isArray(p) ? p[0]?.name : p.name;
    const truncatedValue = value
      ? value.length > CHART_TOOLTIP_MAX_VALUE_LENGTH
        ? `${value.slice(0, CHART_TOOLTIP_MAX_VALUE_LENGTH)}...`
        : value
      : '\u2014';
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
          >${truncatedValue}</strong>
          <span>${pct}</span>
        </div>
      </div>
    `.trim();
  }, []);

  const actionsHtmlRenderer = useCallback(
    (value: string) =>
      tooltipActionsHtmlRenderer(value, attributeDistribution.name, theme),
    [attributeDistribution.name, theme]
  );

  const tooltipConfig = useAttributeBreakdownsTooltip({
    chartRef,
    formatter: toolTipFormatter,
    chartWidth,
    actionsHtmlRenderer,
  });

  const chartXAxisLabelFormatter = useCallback(
    (value: string): string => {
      return formatChartXAxisLabel(value, seriesData.length, chartWidth);
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
    <AttributeBreakdownsComponent.ChartWrapper>
      <AttributeBreakdownsComponent.ChartHeaderWrapper
        justify="between"
        align="center"
        gap="lg"
      >
        <Tooltip title={attributeDistribution.name} showOnlyOnOverflow skipWrapper>
          <AttributeBreakdownsComponent.ChartTitle>
            {attributeDistribution.name}
          </AttributeBreakdownsComponent.ChartTitle>
        </Tooltip>
        <Flex gap="sm">
          <AttributeBreakdownsComponent.PopulationIndicator color={color}>
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
          </AttributeBreakdownsComponent.PopulationIndicator>
        </Flex>
      </AttributeBreakdownsComponent.ChartHeaderWrapper>
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
            seriesData.length > CHART_HIGH_CARDINALITY_THRESHOLD
              ? {
                  show: false,
                }
              : {
                  hideOverlap: false,
                  showMaxLabel: false,
                  showMinLabel: false,
                  color: '#000',
                  interval: 0,
                  fontSize: CHART_AXIS_LABEL_FONT_SIZE,
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
            barMaxWidth: CHART_MAX_BAR_WIDTH,
            animation: false,
          },
        ]}
      />
    </AttributeBreakdownsComponent.ChartWrapper>
  );
}
