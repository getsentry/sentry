import {browserHistory} from 'react-router';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/performance/database/settings';
import {useAvailableDurationAggregates} from 'sentry/views/performance/database/useAvailableDurationAggregates';

type Query = {
  aggregate: string;
};

// TODO: Type more strictly, these should be limited to only valid aggregate
// functions
type Result = [string, (string) => void];

export function useSelectedDurationAggregate(): Result {
  const [previouslySelectedAggregate, setPreviouslySelectedAggregate] =
    useLocalStorageState(KEY, DEFAULT_DURATION_AGGREGATE);

  const setSelectedAggregate = aggregate => {
    setPreviouslySelectedAggregate(aggregate);

    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        aggregate,
      },
    });
  };

  const availableAggregates = useAvailableDurationAggregates();

  const location = useLocation<Query>();

  let selectedAggregate = decodeScalar(
    location.query.aggregate,
    previouslySelectedAggregate
  );

  if (!availableAggregates.includes(selectedAggregate)) {
    selectedAggregate = DEFAULT_DURATION_AGGREGATE;
  }

  return [selectedAggregate, setSelectedAggregate];
}

const KEY = 'performance-database-default-aggregation-function';
