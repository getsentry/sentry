import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {PieSeriesOption} from 'echarts';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SuspectAttributesResult} from 'sentry/views/explore/hooks/useSuspectAttributes';

type Props = {
  attribute: SuspectAttributesResult['rankedAttributes'][number];
  totalBaseline?: number;
  totalSelected?: number;
};

export function NullValuesPieCharts({attribute, totalSelected, totalBaseline}: Props) {
  const theme = useTheme();

  const selectedNullData = useMemo(() => {
    // Default to 10000 for testing if totals are null/undefined
    const effectiveTotalSelected = totalSelected ?? 10000;

    const totalValues = attribute.cohort1.reduce(
      (acc, curr) => acc + Number(curr.value),
      0
    );
    const nullValues = effectiveTotalSelected - totalValues;
    const nullPercentage =
      effectiveTotalSelected > 0 ? (nullValues / effectiveTotalSelected) * 100 : 0;
    const valuesPercentage =
      effectiveTotalSelected > 0 ? (totalValues / effectiveTotalSelected) * 100 : 0;

    return [
      {
        name: t('Has Value'),
        value: valuesPercentage,
        count: totalValues,
        itemStyle: {
          color: theme.chart.getColorPalette(0)?.[0],
        },
      },
      {
        name: t('Null'),
        value: nullPercentage,
        count: nullValues,
        itemStyle: {
          color: theme.gray200,
        },
      },
    ];
  }, [attribute.cohort1, totalSelected, theme]);

  const baselineNullData = useMemo(() => {
    // Default to 10000 for testing if totals are null/undefined
    const effectiveTotalBaseline = totalBaseline ?? 10000;

    const totalValues = attribute.cohort2.reduce(
      (acc, curr) => acc + Number(curr.value),
      0
    );
    const nullValues = effectiveTotalBaseline - totalValues;
    const nullPercentage =
      effectiveTotalBaseline > 0 ? (nullValues / effectiveTotalBaseline) * 100 : 0;
    const valuesPercentage =
      effectiveTotalBaseline > 0 ? (totalValues / effectiveTotalBaseline) * 100 : 0;

    return [
      {
        name: t('Has Value'),
        value: valuesPercentage,
        count: totalValues,
        itemStyle: {
          color: theme.chart.getColorPalette(0)?.[0],
        },
      },
      {
        name: t('Null'),
        value: nullPercentage,
        count: nullValues,
        itemStyle: {
          color: theme.gray200,
        },
      },
    ];
  }, [attribute.cohort2, totalBaseline, theme]);

  const createTooltip = (isSelected: boolean): TooltipOption => ({
    trigger: 'item',
    borderWidth: 0,
    backgroundColor: theme.surface100,
    hideDelay: 0,
    transitionDuration: 0,
    padding: 12,
    extraCssText: 'border-radius: 6px;',
    textStyle: {
      color: theme.textColor,
      fontFamily: theme.text.family,
    },
    formatter: function (params: any) {
      const value = typeof params.value === 'number' ? params.value : 0;
      const count = params.data?.count || 0;
      // Use effective totals with defaults for testing
      const total = isSelected ? (totalSelected ?? 10000) : (totalBaseline ?? 10000);

      return `
        <div style="font-family: ${theme.text.family};">
          <div style="display: flex; align-items: center; font-size: 12px; font-weight: bold; line-height: 1; margin-bottom: ${space(1)}; gap: ${space(1)}">
            <div style="flex: initial; width: 8px !important; height: 8px !important; border-radius: 50%; background-color: ${params.color};"></div>
            <span style="color: ${theme.textColor}">${params.name}</span>
          </div>
          <div style="display: flex; flex-direction: column; line-height: 1; gap: ${space(0.5)}">
            <p style="font-size: 14px; font-weight: bold; margin: 0;">${count.toLocaleString()}</p>
            <p style="font-size: 12px; margin: 0;">${value.toFixed(1)}% of ${total.toLocaleString()} ${isSelected ? 'selected' : 'baseline'}</p>
          </div>
        </div>
      `;
    },
  });

  const createSeries = (
    data: typeof selectedNullData,
    center: [string, string]
  ): PieSeriesOption => ({
    name: 'Null Values',
    type: 'pie',
    radius: ['40%', '70%'],
    center,
    avoidLabelOverlap: false,
    itemStyle: {
      borderRadius: 4,
      borderColor: theme.surface100,
      borderWidth: 1,
    },
    label: {
      show: true,
      position: 'outside',
      formatter: '{d}%',
      fontSize: 11,
      fontFamily: theme.text.family,
      color: theme.textColor,
    },
    labelLine: {
      show: true,
      lineStyle: {
        color: theme.border,
      },
    },
    emphasis: {
      label: {
        show: true,
        fontSize: 12,
        fontWeight: 'bold',
      },
      itemStyle: {
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowColor: theme.gray100,
      },
    },
    data,
  });

  return (
    <Container>
      <ChartSection>
        <ChartTitle>{t('Selected Data')}</ChartTitle>
        <ChartContainer>
          <BaseChart
            height={180}
            renderer="canvas"
            series={[createSeries(selectedNullData, ['50%', '50%'])]}
            tooltip={createTooltip(true)}
            xAxis={null}
            yAxis={null}
          />
        </ChartContainer>
      </ChartSection>
      <ChartSection>
        <ChartTitle>{t('Baseline Data')}</ChartTitle>
        <ChartContainer>
          <BaseChart
            height={180}
            renderer="canvas"
            series={[createSeries(baselineNullData, ['50%', '50%'])]}
            tooltip={createTooltip(false)}
            xAxis={null}
            yAxis={null}
          />
        </ChartContainer>
      </ChartSection>
    </Container>
  );
}

const Container = styled(Flex)`
  gap: ${space(3)};
  margin-top: ${space(2)};
  margin-bottom: ${space(2)};
`;

const ChartSection = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(1)};
  text-align: center;
`;

const ChartContainer = styled('div')`
  flex: 1;
  min-height: 180px;
`;
