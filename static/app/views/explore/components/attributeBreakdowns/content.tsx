import {parseAsString} from 'nuqs';

import {useLocation} from 'sentry/utils/useLocation';
import {
  useQueryParamsQuery,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {loadQueryParamsFromLocation} from 'sentry/views/explore/queryParams/parsers';
import {getSpansHeatMapYAxis} from 'sentry/views/explore/spans/charts/spansHeatMap';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';

import {AttributeDistribution} from './attributeDistributionContent';
import {useChartSelection} from './chartSelectionContext';
import {CohortComparison} from './cohortComparisonContent';

const COHORT_QUERY_PARSERS = {extrapolate: parseAsString.withDefault('1')};

export function AttributeBreakdownsContent() {
  const {chartSelection} = useChartSelection();
  const location = useLocation();
  const visualizes = useQueryParamsVisualizes();
  const dataset = useSpansDataset();

  const query = useQueryParamsQuery();
  const {extrapolate} = loadQueryParamsFromLocation(COHORT_QUERY_PARSERS, location);

  if (chartSelection) {
    const visualize = visualizes[chartSelection.chartIndex];
    const yAxis = visualize?.yAxis ?? '';

    return (
      <CohortComparison
        selection={chartSelection.selection}
        yAxis={yAxis}
        yAttribute={visualize ? getSpansHeatMapYAxis(visualize) : undefined}
        yRange={chartSelection.yRange}
        query={query}
        dataset={dataset}
        extrapolate={extrapolate}
      />
    );
  }

  return <AttributeDistribution />;
}
