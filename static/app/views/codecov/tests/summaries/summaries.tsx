import {SummaryContainer} from 'sentry/components/codecov/summary';
import {useTestResultsAggregates} from 'sentry/views/codecov/tests/queries/useTestResultsAggregates';
import {CIEfficiency} from 'sentry/views/codecov/tests/summaries/ciEfficiency';
import {TestPerformance} from 'sentry/views/codecov/tests/summaries/testPerformance';

const testPerformanceData = {
  flakyTests: 88,
  flakyTestsChange: -0.95,
  averageFlakeRate: 0.1,
  averageFlakeRateChange: 0.62,
  cumulativeFailures: 356,
  cumulativeFailuresChange: 0.96,
  skippedTests: 50,
  skippedTestsChange: 0.04,
};

export function Summaries() {
  const {data: testAggregateData, isLoading: isTestAggregateLoading} =
    useTestResultsAggregates();

  if (isTestAggregateLoading) {
    return null;
  }

  return (
    <SummaryContainer columns={24}>
      <CIEfficiency {...testAggregateData} isLoading={isTestAggregateLoading} />
      <TestPerformance {...testPerformanceData} isLoading={false} />
    </SummaryContainer>
  );
}
