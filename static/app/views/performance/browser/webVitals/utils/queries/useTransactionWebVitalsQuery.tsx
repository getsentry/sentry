import {Sort} from 'sentry/utils/discover/fields';
import {useTransactionRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useTransactionRawWebVitalsQuery';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  opportunityWebVital?: WebVitals | 'total';
  sortName?: string;
  transaction?: string | null;
};

export const useTransactionWebVitalsQuery = ({
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
  opportunityWebVital,
  enabled,
}: Props) => {
  const shouldUseStoredScores = useStoredScoresSetting();
  const storedScoresResult = useTransactionWebVitalsScoresQuery({
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled: shouldUseStoredScores && enabled,
    opportunityWebVital,
  });
  const rawWebVitalsResult = useTransactionRawWebVitalsQuery({
    limit,
    transaction,
    defaultSort,
    sortName,
    enabled: !shouldUseStoredScores && enabled,
  });
  if (shouldUseStoredScores) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
