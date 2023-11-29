import {Sort} from 'sentry/utils/discover/fields';
import {USE_STORED_SCORES} from 'sentry/views/performance/browser/webVitals/settings';
import {useTransactionRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useTransactionRawWebVitalsQuery';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  defaultSort?: Sort;
  limit?: number;
  orderBy?: WebVitals | null;
  sortName?: string;
  transaction?: string | null;
};

export const useTransactionWebVitalsQuery = ({
  orderBy,
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
}: Props) => {
  const storedScoresResult = useTransactionWebVitalsScoresQuery({
    orderBy,
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled: USE_STORED_SCORES,
  });
  const rawWebVitalsResult = useTransactionRawWebVitalsQuery({
    orderBy,
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled: !USE_STORED_SCORES,
  });
  if (USE_STORED_SCORES) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
