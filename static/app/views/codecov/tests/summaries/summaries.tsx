import {SummaryContainer} from 'sentry/components/codecov/summary';
import {CIEfficiency} from 'sentry/views/codecov/tests/summaries/ciEfficiency';
import {TestPerformance} from 'sentry/views/codecov/tests/summaries/testPerformance';

const testCIEfficiencyData = {
  totalTestsRunTime: 12300000,
  totalTestsRunTimeChange: 0.46,
  slowestTests: 100,
  slowestTestsDuration: 10000,
};

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
  return (
    <SummaryContainer columns={24}>
      <CIEfficiency {...testCIEfficiencyData} isLoading={false} />
      <TestPerformance {...testPerformanceData} isLoading={false} />
    </SummaryContainer>
  );
}
