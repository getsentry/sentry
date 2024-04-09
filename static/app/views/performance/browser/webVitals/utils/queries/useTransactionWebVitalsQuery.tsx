import type {Sort} from 'sentry/utils/discover/fields';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  query?: string;
  shouldEscapeFilters?: boolean;
  sortName?: string;
  transaction?: string | null;
  webVital?: WebVitals | 'total';
};

export const useTransactionWebVitalsQuery = ({
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
  webVital,
  enabled,
  query,
  shouldEscapeFilters = true,
}: Props) => {
  const storedScoresResult = useTransactionWebVitalsScoresQuery({
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled,
    webVital,
    query,
    shouldEscapeFilters,
  });
  return storedScoresResult;
};
