import type {Sort} from 'sentry/utils/discover/fields';
import {useTransactionRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useTransactionRawWebVitalsQuery';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  query?: string;
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
}: Props) => {
  const shouldUseStoredScores = useStoredScoresSetting();
  const storedScoresResult = useTransactionWebVitalsScoresQuery({
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled: shouldUseStoredScores && enabled,
    webVital,
    query,
  });
  const rawWebVitalsResult = useTransactionRawWebVitalsQuery({
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled: !shouldUseStoredScores && enabled,
    query,
  });
  if (shouldUseStoredScores) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
