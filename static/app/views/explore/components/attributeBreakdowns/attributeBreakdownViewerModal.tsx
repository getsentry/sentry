import {Fragment, useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {closeModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import {transformTableToCategoricalSeries} from 'sentry/utils/categoricalTimeSeries/transformTableToCategoricalSeries';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {CategoricalSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {Bars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';
import type {
  TabularColumn,
  TabularData,
} from 'sentry/views/dashboards/widgets/common/types';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {Actions} from 'sentry/views/discover/table/cellAction';
import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {getExploreUrl} from 'sentry/views/explore/utils';

import type {AttributeDistribution} from './attributeDistributionContent';
import {CHART_MAX_SERIES_LENGTH, COHORT_2_COLOR, MODAL_CHART_HEIGHT} from './constants';
import {calculateAttributePopulationPercentage, percentageFormatter} from './utils';

type RankedAttribute = AttributeBreakdownsComparison['rankedAttributes'][number];
type CohortData = RankedAttribute['cohort1'];

// Discriminated union for single vs comparison mode
type SingleModeOptions = {
  attributeDistribution: AttributeDistribution[number];
  cohortCount: number;
  mode: 'single';
  query: string;
};

type ComparisonModeOptions = {
  attribute: RankedAttribute;
  cohort1Total: number;
  cohort2Total: number;
  mode: 'comparison';
  query: string;
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
  tableColumns: TabularColumn[];
  tableData: TabularData;
};

type ComparisonModeData = {
  attributeName: string;
  mode: 'comparison';
  populationPercentages: {primary: number; secondary: number};
  tableColumns: TabularColumn[];
  tableData: TabularData;
};

const SINGLE_MODE_CHART_QUERY: WidgetQuery = {
  columns: [t('Value')],
  aggregates: [t('Percentage')],
  conditions: '',
  name: '',
  orderby: '',
};

const COMPARISON_MODE_CHART_QUERY: WidgetQuery = {
  columns: [t('Value')],
  aggregates: [t('Selected %'), t('Baseline %')],
  conditions: '',
  name: '',
  orderby: '',
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

export default function AttributeBreakdownViewerModal(props: Props) {
  const {Header, Body, mode, query} = props;
  const {selection} = usePageFilters();

  const theme = useTheme();
  const navigate = useNavigate();
  const organization = useOrganization();
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

  const chartSeries = useMemo(() => {
    const slicedTableData: TabularData = {
      ...computedData.tableData,
      data: computedData.tableData.data.slice(0, CHART_MAX_SERIES_LENGTH),
    };
    const chartQuery =
      computedData.mode === 'comparison'
        ? COMPARISON_MODE_CHART_QUERY
        : SINGLE_MODE_CHART_QUERY;
    return transformTableToCategoricalSeries(chartQuery, slicedTableData);
  }, [computedData.tableData, computedData.mode]);

  const hasPlottableValues = useMemo(() => {
    return chartSeries.some(series => series.values.some(value => value.value !== null));
  }, [chartSeries]);
  const singleSeries = chartSeries[0];
  const selectedSeries = chartSeries[0];
  const baselineSeries = chartSeries[1];

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
              {computedData.mode === 'single' && singleSeries && hasPlottableValues ? (
                <CategoricalSeriesWidgetVisualization
                  plottables={[new Bars(singleSeries, {color: primaryColor})]}
                  showLegend="never"
                />
              ) : computedData.mode === 'comparison' &&
                selectedSeries &&
                baselineSeries &&
                hasPlottableValues ? (
                <CategoricalSeriesWidgetVisualization
                  plottables={[
                    new Bars(selectedSeries, {color: primaryColor, alias: 'selected'}),
                    new Bars(baselineSeries, {color: secondaryColor, alias: 'baseline'}),
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
            onTriggerCellAction={(action, value) => {
              const search = new MutableSearch(query ?? '');
              switch (action) {
                case Actions.OPEN_ROW_IN_EXPLORE:
                  search.addFilterValue(computedData.attributeName, `${value}`);
                  navigate(
                    getExploreUrl({
                      organization,
                      selection,
                      query: search.formatString(),
                    })
                  );
                  closeModal();
                  return;
                case Actions.ADD:
                  search.addFilterValue(computedData.attributeName, `${value}`);
                  navigate(
                    getExploreUrl({
                      organization,
                      selection,
                      table: 'attribute_breakdowns',
                      query: search.formatString(),
                    })
                  );
                  closeModal();
                  return;
                case Actions.EXCLUDE:
                  search.addFilterValue(`!${computedData.attributeName}`, `${value}`);
                  navigate(
                    getExploreUrl({
                      organization,
                      selection,
                      table: 'attribute_breakdowns',
                      query: search.formatString(),
                    })
                  );
                  closeModal();
                  return;
                case Actions.COPY_TO_CLIPBOARD:
                  closeModal();
                  return;
                default:
                  return;
              }
            }}
            allowedCellActions={cellInfo => {
              if (cellInfo.column.key === t('Value')) {
                return [
                  Actions.OPEN_ROW_IN_EXPLORE,
                  Actions.EXCLUDE,
                  Actions.ADD,
                  Actions.COPY_TO_CLIPBOARD,
                ];
              }
              return [];
            }}
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
