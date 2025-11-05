import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';
import type {CallbackDataParams} from 'echarts/types/dist/shared';

import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import BaseChart from 'sentry/components/charts/baseChart';
import {Flex} from 'sentry/components/core/layout';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {AttributeBreakdownsResult} from 'sentry/views/explore/hooks/useAttributeBreakdowns';

const MAX_BAR_WIDTH = 20;
const HIGH_CARDINALITY_THRESHOLD = 20;
const AXIS_LABEL_FONT_SIZE = 12;
const TOOLTIP_MAX_VALUE_LENGTH = 300;
const MAX_CHART_SERIES_LENGTH = 40;

const SELECTED_SERIES_NAME = 'selected';
const BASELINE_SERIES_NAME = 'baseline';

type CohortData = AttributeBreakdownsResult['rankedAttributes'][number]['cohort1'];

function calculatePopulationPercentage(cohort: CohortData, cohortTotal: number): number {
  if (cohortTotal === 0) return 0;

  const populatedCount = cohort.reduce((acc, curr) => acc + Number(curr.value), 0);
  return (populatedCount / cohortTotal) * 100;
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
  attribute: AttributeBreakdownsResult['rankedAttributes'][number];
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

  const populationPercentages = useMemo(
    () => ({
      selected: calculatePopulationPercentage(attribute.cohort1, cohort1Total),
      baseline: calculatePopulationPercentage(attribute.cohort2, cohort2Total),
    }),
    [attribute.cohort1, attribute.cohort2, cohort1Total, cohort2Total]
  );

  const toolTipValueFormatter = useCallback(
    (_value: number, _label?: string, seriesParams?: CallbackDataParams) => {
      const percentage = Number(seriesParams?.data);

      if (isNaN(percentage) || !isFinite(percentage)) {
        return '\u2014';
      }

      if (percentage < 0.1) {
        return `<0.1%`;
      }

      return `${percentage.toFixed(1)}%`;
    },
    []
  );

  const toolTipFormatAxisLabel = useCallback(
    (
      _value: number,
      _isTimestamp: boolean,
      _utc: boolean,
      _showTimeInTooltip: boolean,
      _addSecondsToTimeFormat: boolean,
      _bucketSize: number | undefined,
      seriesParamsOrParam: TooltipComponentFormatterCallbackParams
    ) => {
      if (!Array.isArray(seriesParamsOrParam)) {
        return '\u2014';
      }

      const selectedParam = seriesParamsOrParam.find(
        s => s.seriesName === SELECTED_SERIES_NAME
      );
      const baselineParam = seriesParamsOrParam.find(
        s => s.seriesName === BASELINE_SERIES_NAME
      );

      if (!selectedParam || !baselineParam) {
        throw new Error('selectedParam or baselineParam is not defined');
      }

      const selectedPercentage = Number(selectedParam?.data);
      const baselinePercentage = Number(baselineParam?.data);

      const isDifferent = selectedPercentage.toFixed(1) !== baselinePercentage.toFixed(1);

      const status = isDifferent
        ? {adjective: 'different', message: 'This is suspicious.'}
        : {adjective: 'similar', message: 'Nothing unusual here.'};

      const name = selectedParam?.name ?? baselineParam?.name ?? '';
      const truncatedName =
        name.length > TOOLTIP_MAX_VALUE_LENGTH
          ? `${name.slice(0, TOOLTIP_MAX_VALUE_LENGTH)}...`
          : name;

      return `<div style="max-width: 200px; white-space: normal; word-wrap: break-word; line-height: 1.2;">${truncatedName} <span style="color: ${theme.textColor};">is <strong>${status.adjective}</strong> ${isDifferent ? 'between' : 'across'} selected and baseline data. ${status.message}</span></div>`;
    },
    [theme.textColor]
  );

  const chartXAxisLabelFormatter = useCallback(
    (value: string): string => {
      const labelsCount = seriesData[SELECTED_SERIES_NAME].length;
      const pixelsPerLabel = chartWidth / labelsCount;

      //  Average width of a character is 0.6 times the font size
      const pixelsPerCharacter = 0.6 * AXIS_LABEL_FONT_SIZE;

      // Compute the max number of characters that can fit
      const maxChars = Math.floor(pixelsPerLabel / pixelsPerCharacter);

      // If value fits, return it as-is
      if (value.length <= maxChars) return value;

      // Otherwise, truncate and append '…'
      const truncatedLength = Math.max(0, maxChars - 1); // leaving space for (ellipsis)
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
      <ChartHeaderWrapper>
        <Flex justify="between" align="center">
          <ChartTitle>{attribute.attributeName}</ChartTitle>
          <Flex gap="sm">
            <PopulationIndicator
              color={cohort1Color}
              title={`${populationPercentages.selected.toFixed(1)}% of selected cohort has this attribute populated`}
            >
              <Tooltip
                showUnderline
                title={`${populationPercentages.selected.toFixed(1)}% of selected cohort has this attribute populated`}
              >
                {populationPercentages.selected.toFixed(0)}%
              </Tooltip>
            </PopulationIndicator>
            <PopulationIndicator
              color={cohort2Color}
              title={`${populationPercentages.baseline.toFixed(1)}% of baseline cohort has this attribute populated`}
            >
              <Tooltip
                showUnderline
                title={`${populationPercentages.baseline.toFixed(1)}% of baseline cohort has this attribute populated`}
              >
                {populationPercentages.baseline.toFixed(0)}%
              </Tooltip>
            </PopulationIndicator>
          </Flex>
        </Flex>
      </ChartHeaderWrapper>
      <BaseChart
        ref={chartRef}
        autoHeightResize
        isGroupedByDate={false}
        tooltip={{
          appendToBody: true,
          trigger: 'axis',
          renderMode: 'html',
          valueFormatter: toolTipValueFormatter,
          formatAxisLabel: toolTipFormatAxisLabel,
        }}
        grid={{
          left: 2,
          right: 8,
          containLabel: true,
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
          axisLabel: {
            show: false,
            width: 0,
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
`;

const ChartHeaderWrapper = styled('div')`
  margin-bottom: ${space(1)};
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.gray500};
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
