import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import {Flex} from 'sentry/components/core/layout';
import {tct} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {escape} from 'sentry/utils';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {useAttributeBreakdownsTooltip} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import {
  CHART_MAX_BAR_WIDTH,
  CHART_MAX_SERIES_LENGTH,
  CHART_TOOLTIP_MAX_VALUE_LENGTH,
} from './constants';
import {AttributeBreakdownsComponent} from './styles';
import {
  calculateAttrubutePopulationPercentage,
  percentageFormatter,
  tooltipActionsHtmlRenderer,
} from './utils';

const CHART_SELECTED_SERIES_NAME = 'selected';
const CHART_BASELINE_SERIES_NAME = 'baseline';

type CohortData = AttributeBreakdownsComparison['rankedAttributes'][number]['cohort1'];

function cohortsToSeriesData(
  cohort1: CohortData,
  cohort2: CohortData,
  seriesTotals: {
    [CHART_BASELINE_SERIES_NAME]: number;
    [CHART_SELECTED_SERIES_NAME]: number;
  }
): {
  [CHART_BASELINE_SERIES_NAME]: Array<{label: string; value: number}>;
  [CHART_SELECTED_SERIES_NAME]: Array<{label: string; value: number}>;
} {
  const cohort1Map = new Map(cohort1.map(({label, value}) => [label, value]));
  const cohort2Map = new Map(cohort2.map(({label, value}) => [label, value]));

  const uniqueLabels = new Set([...cohort1Map.keys(), ...cohort2Map.keys()]);

  // From the unique labels, we create two series data objects, one for the selected cohort and one for the baseline cohort.
  // If a label isn't present in either of the cohorts, we assign a value of 0, to that label in the respective series.
  // We sort by descending value of the selected cohort
  const seriesData = Array.from(uniqueLabels)
    .map(label => {
      const selectedVal = cohort1Map.get(label) ?? '0';
      const baselineVal = cohort2Map.get(label) ?? '0';

      const selectedPercentage =
        seriesTotals[CHART_SELECTED_SERIES_NAME] === 0
          ? 0
          : (Number(selectedVal) / seriesTotals[CHART_SELECTED_SERIES_NAME]) * 100;
      const baselinePercentage =
        seriesTotals[CHART_BASELINE_SERIES_NAME] === 0
          ? 0
          : (Number(baselineVal) / seriesTotals[CHART_BASELINE_SERIES_NAME]) * 100;

      return {
        label,
        selectedValue: selectedPercentage,
        baselineValue: baselinePercentage,
        sortValue: selectedPercentage,
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, CHART_MAX_SERIES_LENGTH);

  const selectedSeriesData: Array<{label: string; value: number}> = [];
  const baselineSeriesData: Array<{label: string; value: number}> = [];

  for (const {label, selectedValue, baselineValue} of seriesData) {
    selectedSeriesData.push({label, value: selectedValue});
    baselineSeriesData.push({label, value: baselineValue});
  }

  return {
    [CHART_SELECTED_SERIES_NAME]: selectedSeriesData,
    [CHART_BASELINE_SERIES_NAME]: baselineSeriesData,
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
      selected: calculateAttrubutePopulationPercentage(attribute.cohort1, cohort1Total),
      baseline: calculateAttrubutePopulationPercentage(attribute.cohort2, cohort2Total),
    }),
    [attribute.cohort1, attribute.cohort2, cohort1Total, cohort2Total]
  );

  const toolTipFormatter = useCallback(
    (p: TooltipComponentFormatterCallbackParams) => {
      if (!Array.isArray(p)) {
        return '\u2014';
      }

      const selectedParam = p.find(s => s.seriesName === CHART_SELECTED_SERIES_NAME);
      const baselineParam = p.find(s => s.seriesName === CHART_BASELINE_SERIES_NAME);

      if (!selectedParam || !baselineParam) {
        throw new Error('selectedParam or baselineParam is not defined');
      }

      const selectedValue = selectedParam.value;
      const baselineValue = baselineParam.value;
      const selectedPct = percentageFormatter(Number(selectedValue));
      const baselinePct = percentageFormatter(Number(baselineValue));

      const name = selectedParam.name ?? baselineParam.name ?? '';
      const truncatedName =
        name.length > CHART_TOOLTIP_MAX_VALUE_LENGTH
          ? `${name.slice(0, CHART_TOOLTIP_MAX_VALUE_LENGTH)}...`
          : name;
      const escapedTruncatedName = escape(truncatedName);

      return `
      <div class="tooltip-series" style="padding: 0;">
        <div class="tooltip-label" style="display: flex; flex-direction: column; align-items: stretch; gap: 8px; margin: 0 auto; padding: 8px 15px; min-width: 100px; max-width: 300px; cursor: default;">
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
        <Flex gap="sm">
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
