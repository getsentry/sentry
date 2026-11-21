import {useLocation} from 'sentry/utils/useLocation';
import {useQueryParamsVisualizes} from 'sentry/views/explore/queryParams/context';
import {getSpansHeatMapYAxis} from 'sentry/views/explore/spans/charts/spansHeatMap';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';

import {AttributeDistribution} from './attributeDistributionContent';
import {useChartSelection} from './chartSelectionContext';
import {CohortComparison} from './cohortComparisonContent';

export function AttributeBreakdownsContent() {
  const {chartSelection} = useChartSelection();
  const location = useLocation();
  const visualizes = useQueryParamsVisualizes();
  const dataset = useSpansDataset();

  const query = location.query.query?.toString() ?? '';
  const extrapolate = location.query.extrapolate?.toString() ?? '1';

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
