import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/performance/database/settings';
import {useAvailableDurationAggregates} from 'sentry/views/performance/database/useAvailableDurationAggregates';
import type {Aggregate} from 'sentry/views/starfish/types';

type Query = {
  aggregate: string;
};

type Result = [Aggregate, (string) => void];

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

  const aggregateFromURL = decodeScalar(
    location.query.aggregate,
    previouslySelectedAggregate
  );

  const selectedAggregate = isAnAvailableAggregate(aggregateFromURL, availableAggregates)
    ? aggregateFromURL
    : DEFAULT_DURATION_AGGREGATE;

  return [selectedAggregate, setSelectedAggregate];
}

function isAnAvailableAggregate(
  maybeAggregate: string,
  availableAggregates: Aggregate[]
): maybeAggregate is Aggregate {
  // Manually widen `availableAggregates` to allow the comparison to string
  return (availableAggregates as unknown as string[]).includes(
    maybeAggregate as Aggregate
  );
}

const KEY = 'performance-database-default-aggregation-function';
