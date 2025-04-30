import {SummaryContainer} from 'sentry/components/codecov/summary';
import {CIEfficiency} from 'sentry/views/codecov/tests/summaries/ciEfficiency';

const testCIEfficiencyData = {
  totalTestsRunTime: 12300000,
  totalTestsRunTimeChange: 0.46,
  slowestTests: 100,
  slowestTestsDuration: 10000,
};

export function Summaries() {
  return (
    <SummaryContainer columns={24}>
      <CIEfficiency {...testCIEfficiencyData} isLoading={false} />
    </SummaryContainer>
  );
}
