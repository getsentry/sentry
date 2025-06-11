import {SummaryContainer} from 'sentry/components/codecov/summary';
import {useTestResultsAggregates} from 'sentry/views/codecov/tests/queries/useTestResultsAggregates';
import {CIEfficiency} from 'sentry/views/codecov/tests/summaries/ciEfficiency';
import {TestPerformance} from 'sentry/views/codecov/tests/summaries/testPerformance';

export function Summaries() {
  const {data, isLoading} = useTestResultsAggregates();

  const ciEfficiencyData = data?.ciEfficiency;
  const testPerformanceData = data?.testPerformance;

  return (
    <SummaryContainer columns={24}>
      <CIEfficiency {...ciEfficiencyData} isLoading={isLoading} />
      <TestPerformance {...testPerformanceData} isLoading={isLoading} />
    </SummaryContainer>
  );
}
