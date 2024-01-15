import {browserHistory} from 'react-router';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/performance/database/settings';
import {useAvailableDurationAggregates} from 'sentry/views/performance/database/useAvailableDurationAggregates';
import {Aggregate} from 'sentry/views/starfish/types';

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

  let selectedAggregate: Aggregate;
  const aggregateFromURL = decodeScalar(
    location.query.aggregate,
    previouslySelectedAggregate
  );

  // `availableAggregates` is typed `as const` so I have to cast to unknown to allow comparison to string
  if ((availableAggregates as unknown as string[]).includes(aggregateFromURL)) {
    selectedAggregate = aggregateFromURL as Aggregate;
  } else {
    selectedAggregate = DEFAULT_DURATION_AGGREGATE;
  }

  return [selectedAggregate, setSelectedAggregate];
}

const KEY = 'performance-database-default-aggregation-function';
