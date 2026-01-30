import {Fragment, useCallback, useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {t} from 'sentry/locale';
import type {
  TabularColumn,
  TabularData,
} from 'sentry/views/dashboards/widgets/common/types';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';

import type {AttributeDistribution} from './attributeDistributionContent';
import {
  CHART_AXIS_LABEL_FONT_SIZE,
  CHART_BASELINE_SERIES_NAME,
  CHART_MAX_BAR_WIDTH,
  CHART_SELECTED_SERIES_NAME,
  COHORT_2_COLOR,
  MODAL_CHART_HEIGHT,
} from './constants';
import {useFormatComparisonModeTooltip, useFormatSingleModeTooltip} from './tooltips';
import {
  calculateAttributePopulationPercentage,
  cohortsToSeriesData,
  distributionToSeriesData,
  percentageFormatter,
} from './utils';

type RankedAttribute = AttributeBreakdownsComparison['rankedAttributes'][number];
type CohortData = RankedAttribute['cohort1'];

// Discriminated union for single vs comparison mode
type SingleModeOptions = {
  attributeDistribution: AttributeDistribution[number];
  cohortCount: number;
  mode: 'single';
};

type ComparisonModeOptions = {
  attribute: RankedAttribute;
  cohort1Total: number;
  cohort2Total: number;
  mode: 'comparison';
};

export type AttributeBreakdownViewerModalOptions =
  | SingleModeOptions
  | ComparisonModeOptions;

type Props = ModalRenderProps & AttributeBreakdownViewerModalOptions;

// Data computation types
type SingleModeData = {
  attributeName: string;
  maxSeriesValue: number;
  mode: 'single';
  populationPercentages: {primary: number};
  seriesData: {single: Array<{label: string; value: number}>};
  tableColumns: TabularColumn[];
  tableData: TabularData;
  xAxisData: string[];
};

type ComparisonModeData = {
  attributeName: string;
  maxSeriesValue: number;
  mode: 'comparison';
  populationPercentages: {primary: number; secondary: number};
  seriesData: {
    [CHART_BASELINE_SERIES_NAME]: Array<{label: string; value: number}>;
    [CHART_SELECTED_SERIES_NAME]: Array<{label: string; value: number}>;
  };
  tableColumns: TabularColumn[];
  tableData: TabularData;
  xAxisData: string[];
};

function distributionToTableData(
  values: AttributeDistribution[number]['values'],
  cohortCount: number
): TabularData {
  return {
    data: values.map(v => ({
      [t('Value')]: v.label,
      [t('Count')]: v.value,
      [t('Percentage')]: cohortCount === 0 ? 0 : v.value / cohortCount,
    })),
    meta: {
      fields: {
        [t('Value')]: 'string',
        [t('Count')]: 'integer',
        [t('Percentage')]: 'percentage',
      },
      units: {
        [t('Value')]: null,
        [t('Count')]: null,
        [t('Percentage')]: null,
      },
    },
  };
}

function cohortsToTableData(
  cohort1: CohortData,
  cohort2: CohortData,
  cohort1Total: number,
  cohort2Total: number
): TabularData {
  const cohort1Map = new Map(cohort1.map(({label, value}) => [label, value]));
  const cohort2Map = new Map(cohort2.map(({label, value}) => [label, value]));

  const uniqueLabels = new Set([...cohort1Map.keys(), ...cohort2Map.keys()]);

  const data = Array.from(uniqueLabels)
    .map(label => {
      const selectedVal = cohort1Map.get(label) ?? 0;
      const baselineVal = cohort2Map.get(label) ?? 0;

      const selectedPercentage = cohort1Total > 0 ? selectedVal / cohort1Total : 0;
      const baselinePercentage = cohort2Total === 0 ? 0 : baselineVal / cohort2Total;

      return {
        [t('Value')]: label,
        [t('Selected Count')]: selectedVal,
        [t('Selected %')]: selectedPercentage,
        [t('Baseline Count')]: baselineVal,
        [t('Baseline %')]: baselinePercentage,
        _sortValue: selectedPercentage,
      };
    })
    .sort((a, b) => b._sortValue - a._sortValue)
    .map(({_sortValue: _, ...rest}) => rest);

  return {
    data,
    meta: {
      fields: {
        [t('Value')]: 'string',
        [t('Selected Count')]: 'integer',
        [t('Selected %')]: 'percentage',
        [t('Baseline Count')]: 'integer',
        [t('Baseline %')]: 'percentage',
      },
      units: {
        [t('Value')]: null,
        [t('Selected Count')]: null,
        [t('Selected %')]: null,
        [t('Baseline Count')]: null,
        [t('Baseline %')]: null,
      },
    },
  };
}

// Extract single mode data computation
function computeSingleModeData(
  attributeDistribution: AttributeDistribution[number],
  cohortCount: number
): SingleModeData {
  const singleSeriesData = distributionToSeriesData(
    attributeDistribution.values,
    cohortCount
  );

  const singleMaxValue =
    singleSeriesData.length > 0 ? Math.max(...singleSeriesData.map(v => v.value)) : 0;

  const singlePopulation = calculateAttributePopulationPercentage(
    attributeDistribution.values,
    cohortCount
  );

  const singleTableData = distributionToTableData(
    attributeDistribution.values,
    cohortCount
  );
  const singleTableColumns: TabularColumn[] = [
    {key: t('Value'), type: 'string'},
    {key: t('Count'), type: 'integer'},
    {key: t('Percentage'), type: 'percentage'},
  ];

  return {
    mode: 'single',
    attributeName: attributeDistribution.attributeName,
    maxSeriesValue: singleMaxValue,
    populationPercentages: {primary: singlePopulation},
    seriesData: {single: singleSeriesData},
    tableColumns: singleTableColumns,
    tableData: singleTableData,
    xAxisData: singleSeriesData.map(v => v.label),
  };
}

// Extract comparison mode data computation
function computeComparisonModeData(
  attribute: RankedAttribute,
  cohort1Total: number,
  cohort2Total: number
): ComparisonModeData {
  const seriesTotals = {
    [CHART_SELECTED_SERIES_NAME]: cohort1Total,
    [CHART_BASELINE_SERIES_NAME]: cohort2Total,
  };
  const comparisonSeriesData = cohortsToSeriesData(
    attribute.cohort1,
    attribute.cohort2,
    seriesTotals
  );
  const selectedSeries = comparisonSeriesData[CHART_SELECTED_SERIES_NAME];
  const baselineSeries = comparisonSeriesData[CHART_BASELINE_SERIES_NAME];
  const comparisonMaxValue =
    selectedSeries.length > 0 && baselineSeries.length > 0
      ? Math.max(...selectedSeries.map(c => c.value), ...baselineSeries.map(c => c.value))
      : 0;
  const comparisonPopulation = {
    primary: calculateAttributePopulationPercentage(attribute.cohort1, cohort1Total),
    secondary: calculateAttributePopulationPercentage(attribute.cohort2, cohort2Total),
  };
  const comparisonTableData = cohortsToTableData(
    attribute.cohort1,
    attribute.cohort2,
    cohort1Total,
    cohort2Total
  );
  const comparisonTableColumns: TabularColumn[] = [
    {key: t('Value'), type: 'string'},
    {key: t('Selected Count'), type: 'integer'},
    {key: t('Selected %'), type: 'percentage'},
    {key: t('Baseline Count'), type: 'integer'},
    {key: t('Baseline %'), type: 'percentage'},
  ];

  return {
    mode: 'comparison',
    attributeName: attribute.attributeName,
    maxSeriesValue: comparisonMaxValue,
    populationPercentages: comparisonPopulation,
    seriesData: comparisonSeriesData,
    tableColumns: comparisonTableColumns,
    tableData: comparisonTableData,
    xAxisData: selectedSeries.map(c => c.label),
  };
}

// Extract chart series creation
function createSingleModeChartSeries(
  seriesData: {single: Array<{label: string; value: number}>},
  primaryColor: string
) {
  return [
    {
      type: 'bar' as const,
      data: seriesData.single.map(v => v.value),
      itemStyle: {color: primaryColor},
      barMaxWidth: CHART_MAX_BAR_WIDTH,
      animation: false,
    },
  ];
}

function createComparisonModeChartSeries(
  seriesData: {
    [CHART_BASELINE_SERIES_NAME]: Array<{label: string; value: number}>;
    [CHART_SELECTED_SERIES_NAME]: Array<{label: string; value: number}>;
  },
  primaryColor: string,
  secondaryColor: string
) {
  return [
    {
      type: 'bar' as const,
      data: seriesData[CHART_SELECTED_SERIES_NAME].map(c => c.value),
      name: CHART_SELECTED_SERIES_NAME,
      itemStyle: {color: primaryColor},
      barMaxWidth: CHART_MAX_BAR_WIDTH,
      animation: false,
    },
    {
      type: 'bar' as const,
      data: seriesData[CHART_BASELINE_SERIES_NAME].map(c => c.value),
      name: CHART_BASELINE_SERIES_NAME,
      itemStyle: {color: secondaryColor},
      barMaxWidth: CHART_MAX_BAR_WIDTH,
      animation: false,
    },
  ];
}

// Extract population indicator component
type PopulationIndicatorProps = {
  color: string;
  percentage: number;
  tooltipTitle: string;
};

function PopulationIndicatorComponent({
  color,
  percentage,
  tooltipTitle,
}: PopulationIndicatorProps) {
  return (
    <PopulationIndicator color={color}>
      <Tooltip showUnderline title={tooltipTitle}>
        {percentageFormatter(percentage)}
      </Tooltip>
    </PopulationIndicator>
  );
}

export default function AttributeBreakdownViewerModal(props: Props) {
  const {Header, Body, mode} = props;
  const theme = useTheme();
  const formatSingleModeTooltip = useFormatSingleModeTooltip();

  const primaryColor = theme.chart.getColorPalette(0)?.[0];
  const secondaryColor = COHORT_2_COLOR;

  // Compute data based on mode
  const computedData = useMemo(() => {
    if (mode === 'comparison') {
      return computeComparisonModeData(
        props.attribute,
        props.cohort1Total,
        props.cohort2Total
      );
    }

    return computeSingleModeData(props.attributeDistribution, props.cohortCount);
  }, [mode, props]);

  const formatComparisonModeTooltip = useFormatComparisonModeTooltip(
    primaryColor,
    secondaryColor
  );

  const tooltipFormatter = useCallback(
    (p: TooltipComponentFormatterCallbackParams) => {
      if (mode === 'comparison') {
        return formatComparisonModeTooltip(p);
      }
      return formatSingleModeTooltip(p);
    },
    [mode, formatComparisonModeTooltip, formatSingleModeTooltip]
  );

  const tooltipConfig: TooltipOption = useMemo(
    () => ({
      trigger: 'axis',
      appendToBody: true,
      renderMode: 'html',
      formatter: tooltipFormatter,
    }),
    [tooltipFormatter]
  );

  const chartSeries = useMemo(() => {
    if (computedData.mode === 'comparison') {
      return createComparisonModeChartSeries(
        computedData.seriesData as {
          [CHART_BASELINE_SERIES_NAME]: Array<{label: string; value: number}>;
          [CHART_SELECTED_SERIES_NAME]: Array<{label: string; value: number}>;
        },
        primaryColor,
        secondaryColor
      );
    }

    return createSingleModeChartSeries(
      computedData.seriesData as {single: Array<{label: string; value: number}>},
      primaryColor
    );
  }, [computedData.mode, computedData.seriesData, primaryColor, secondaryColor]);

  return (
    <Fragment>
      <Header closeButton>
        <Flex align="center" gap="xl">
          <h3>{computedData.attributeName}</h3>
          {computedData.mode === 'single' ? (
            <PopulationIndicatorComponent
              color={primaryColor}
              percentage={computedData.populationPercentages.primary}
              tooltipTitle={t(
                '%s of spans in your query have this attribute populated',
                percentageFormatter(computedData.populationPercentages.primary)
              )}
            />
          ) : computedData.mode === 'comparison' ? (
            <Flex gap="sm">
              <PopulationIndicatorComponent
                color={primaryColor}
                percentage={computedData.populationPercentages.primary}
                tooltipTitle={t(
                  '%s of selected cohort has this attribute populated',
                  percentageFormatter(computedData.populationPercentages.primary)
                )}
              />
              <PopulationIndicatorComponent
                color={secondaryColor}
                percentage={computedData.populationPercentages.secondary}
                tooltipTitle={t(
                  '%s of baseline cohort has this attribute populated',
                  percentageFormatter(computedData.populationPercentages.secondary)
                )}
              />
            </Flex>
          ) : null}
        </Flex>
      </Header>
      <Body>
        <Flex direction="column" gap="2xl" height="600px">
          <Container height={`${MODAL_CHART_HEIGHT}px`}>
            <BaseChart
              height={MODAL_CHART_HEIGHT}
              isGroupedByDate={false}
              tooltip={tooltipConfig}
              grid={{
                left: 40,
                right: 20,
                bottom: 60,
                top: 20,
                containLabel: false,
              }}
              xAxis={{
                show: true,
                type: 'category',
                data: computedData.xAxisData,
                truncate: 14,
                axisLabel: {
                  hideOverlap: true,
                  showMaxLabel: true,
                  showMinLabel: true,
                  color: theme.tokens.content.secondary,
                  interval: 0,
                  fontSize: CHART_AXIS_LABEL_FONT_SIZE,
                  rotate: computedData.xAxisData.length > 15 ? 45 : 0,
                },
              }}
              yAxis={{
                type: 'value',
                interval: computedData.maxSeriesValue < 1 ? 1 : undefined,
                axisLabel: {
                  fontSize: 12,
                  formatter: (value: number) => {
                    return percentageFormatter(value);
                  },
                },
              }}
              series={chartSeries}
            />
          </Container>
          <TableWidgetVisualization
            scrollable
            tableData={computedData.tableData}
            columns={computedData.tableColumns}
          />
        </Flex>
      </Body>
    </Fragment>
  );
}

const PopulationIndicator = styled(Flex)<{color?: string}>`
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
  font-weight: 500;
  color: ${p => p.color || p.theme.colors.gray500};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${p => p.color || p.theme.colors.gray500};
    margin-right: ${p => p.theme.space.xs};
  }
`;

export const modalCss = css`
  width: 100%;
  max-width: 1000px;
`;
