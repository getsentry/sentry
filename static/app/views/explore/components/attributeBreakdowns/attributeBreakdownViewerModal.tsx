import {Fragment, useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {CategoricalSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {Bars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';
import type {
  CategoricalSeries,
  TabularColumn,
  TabularData,
} from 'sentry/views/dashboards/widgets/common/types';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';

import type {AttributeDistribution} from './attributeDistributionContent';
import {
  CHART_BASELINE_SERIES_NAME,
  CHART_SELECTED_SERIES_NAME,
  COHORT_2_COLOR,
  MODAL_CHART_HEIGHT,
} from './constants';
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
  mode: 'single';
  populationPercentages: {primary: number};
  seriesData: {single: Array<{label: string; value: number}>};
  tableColumns: TabularColumn[];
  tableData: TabularData;
};

type ComparisonModeData = {
  attributeName: string;
  mode: 'comparison';
  populationPercentages: {primary: number; secondary: number};
  seriesData: {
    [CHART_BASELINE_SERIES_NAME]: Array<{label: string; value: number}>;
    [CHART_SELECTED_SERIES_NAME]: Array<{label: string; value: number}>;
  };
  tableColumns: TabularColumn[];
  tableData: TabularData;
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
    populationPercentages: {primary: singlePopulation},
    seriesData: {single: singleSeriesData},
    tableColumns: singleTableColumns,
    tableData: singleTableData,
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
    populationPercentages: comparisonPopulation,
    seriesData: comparisonSeriesData,
    tableColumns: comparisonTableColumns,
    tableData: comparisonTableData,
  };
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

function toCategoricalSeries(
  data: Array<{label: string; value: number}>,
  alias?: string
): CategoricalSeries {
  return {
    valueAxis: alias ?? 'percentage',
    meta: {valueType: 'percentage', valueUnit: null},
    // Data comes in as 0-100 range, but percentage valueType expects 0-1 range
    values: data.map(d => ({category: d.label, value: d.value / 100})),
  };
}

export default function AttributeBreakdownViewerModal(props: Props) {
  const {Header, Body, mode} = props;
  const theme = useTheme();

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
            <Container height={`${MODAL_CHART_HEIGHT}px`} position="relative">
              {computedData.mode === 'single' &&
              computedData.seriesData.single.length > 0 ? (
                <CategoricalSeriesWidgetVisualization
                  plottables={[
                    new Bars(toCategoricalSeries(computedData.seriesData.single), {
                      color: primaryColor,
                    }),
                  ]}
                  showLegend="never"
                />
              ) : computedData.mode === 'comparison' &&
                computedData.seriesData[CHART_SELECTED_SERIES_NAME].length > 0 ? (
                <CategoricalSeriesWidgetVisualization
                  plottables={[
                    new Bars(
                      toCategoricalSeries(
                        computedData.seriesData[CHART_SELECTED_SERIES_NAME],
                        CHART_SELECTED_SERIES_NAME
                      ),
                      {color: primaryColor, alias: 'selected'}
                    ),
                    new Bars(
                      toCategoricalSeries(
                        computedData.seriesData[CHART_BASELINE_SERIES_NAME],
                        CHART_BASELINE_SERIES_NAME
                      ),
                      {color: secondaryColor, alias: 'baseline'}
                    ),
                  ]}
                  showLegend="always"
                />
              ) : null}
            </Container>
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
