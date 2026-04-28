import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openAttributeBreakdownViewerModal} from 'sentry/actionCreators/modal';
import {IconExpand} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {TooltipActions} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';
import {useAttributeBreakdownsTooltip} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import type {AttributeDistribution} from './attributeDistributionContent';
import {CHART_MAX_BAR_WIDTH} from './constants';
import {AttributeBreakdownsComponent} from './styles';
import {useFormatSingleModeTooltip} from './tooltips';
import {
  calculateAttributePopulationPercentage,
  distributionToSeriesData,
  percentageFormatter,
} from './utils';

export function Chart({
  attributeDistribution,
  theme,
  cohortCount,
  query,
  actions,
}: {
  attributeDistribution: AttributeDistribution[number];
  cohortCount: number;
  query: string;
  theme: Theme;
  actions?: TooltipActions | null;
}) {
  const chartRef = useRef<ReactEchartsRef>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const formatSingleModeTooltip = useFormatSingleModeTooltip();

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
      calculateAttributePopulationPercentage(attributeDistribution.values, cohortCount),
    [attributeDistribution.values, cohortCount]
  );

  const tooltipConfig = useAttributeBreakdownsTooltip({
    chartRef,
    formatter: formatSingleModeTooltip,
    chartWidth,
    actions,
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
        <Tooltip
          title={attributeDistribution.attributeName}
          showOnlyOnOverflow
          skipWrapper
        >
          <AttributeBreakdownsComponent.ChartTitle>
            {attributeDistribution.attributeName}
          </AttributeBreakdownsComponent.ChartTitle>
        </Tooltip>
        <Flex gap="sm" align="center">
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
          <Button
            size="zero"
            priority="transparent"
            icon={<IconExpand size="xs" />}
            aria-label={t('Expand chart')}
            onClick={() =>
              openAttributeBreakdownViewerModal({
                mode: 'single',
                attributeDistribution,
                cohortCount,
                query,
              })
            }
          />
        </Flex>
      </AttributeBreakdownsComponent.ChartHeaderWrapper>
      <AttributeBreakdownsComponent.Chart
        chartRef={chartRef}
        chartWidth={chartWidth}
        xAxisData={seriesData.map(value => value.label)}
        maxSeriesValue={maxSeriesValue}
        tooltip={tooltipConfig}
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
