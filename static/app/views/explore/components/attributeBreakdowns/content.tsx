import {useLocation} from 'sentry/utils/useLocation';
import {useQueryParamsVisualizes} from 'sentry/views/explore/queryParams/context';
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
    const yAxis = visualizes[chartSelection.chartIndex]?.yAxis ?? '';

    return (
      <CohortComparison
        selection={chartSelection.selection}
        yAxis={yAxis}
        query={query}
        dataset={dataset}
        extrapolate={extrapolate}
      />
    );
  }

  return <AttributeDistribution />;
}
