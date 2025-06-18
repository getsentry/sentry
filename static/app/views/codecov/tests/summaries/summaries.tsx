import {SummaryContainer} from 'sentry/components/codecov/summary';
import {useTestResultsAggregates} from 'sentry/views/codecov/tests/queries/useTestResultsAggregates';
import {TestAggregates} from 'sentry/views/codecov/tests/summaries/testAggregates';

export function Summaries() {
  const {data, isLoading} = useTestResultsAggregates();

  return (
    <SummaryContainer columns={24}>
      <TestAggregates {...data?.aggregates} isLoading={isLoading} />
    </SummaryContainer>
  );
}
