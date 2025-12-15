import {AttributeDistribution} from './attributeDistributionContent';
import {useChartSelection} from './chartSelectionContext';
import {CohortComparison} from './cohortComparisonContent';

export function AttributeBreakdownsContent() {
  const {chartSelection} = useChartSelection();

  if (chartSelection) {
    return (
      <CohortComparison
        selection={chartSelection.selection}
        chartIndex={chartSelection.chartIndex}
      />
    );
  }

  return <AttributeDistribution />;
}
