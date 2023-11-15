import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useDefaultDurationAggregate} from 'sentry/views/performance/database/useDefaultDurationAggregate';

// TODO: Type more strictly, these should be limited to only valid aggregate
// functions
type Query = {
  aggregate: string;
};

type Result = {
  availableAggregates: string[];
  selectedAggregate: string;
};

export function useAvailableDurationAggregates(): Result {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const defaultDurationAggregate = useDefaultDurationAggregate();
  let availableAggregates = ['avg'];

  const arePercentilesEnabled = organization.features?.includes(
    'performance-database-view-percentiles'
  );

  if (arePercentilesEnabled) {
    availableAggregates = [...availableAggregates, ...['p50', 'p75', 'p95', 'p99']];
  }

  // TODO: Enable this on the backend
  const isMaxEnabled = false;
  if (isMaxEnabled) {
    availableAggregates.push('max');
  }

  let selectedAggregate = decodeScalar(
    location.query.aggregate,
    defaultDurationAggregate
  );

  if (!availableAggregates.includes(selectedAggregate)) {
    selectedAggregate = defaultDurationAggregate;
  }

  return {
    selectedAggregate,
    availableAggregates,
  };
}
