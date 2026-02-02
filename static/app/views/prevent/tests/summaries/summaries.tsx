import {Grid} from '@sentry/scraps/layout';

import {useTestResultsAggregates} from 'sentry/views/prevent/tests/queries/useTestResultsAggregates';
import {CIEfficiency} from 'sentry/views/prevent/tests/summaries/ciEfficiency';
import {TestPerformance} from 'sentry/views/prevent/tests/summaries/testPerformance';

export function Summaries() {
  const {data, isLoading} = useTestResultsAggregates();

  const ciEfficiencyData = data?.ciEfficiency;
  const testPerformanceData = data?.testPerformance;

  return (
    <Grid columns="2fr 4fr" gap="xl">
      <CIEfficiency {...ciEfficiencyData} isLoading={isLoading} />
      <TestPerformance {...testPerformanceData} isLoading={isLoading} />
    </Grid>
  );
}
