import {useTransactionRawSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useTransactionRawSamplesWebVitalsQuery';
import {useTransactionSamplesWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionSamplesWebVitalsScoresQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';

type Props = {
  transaction: string;
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  sortName?: string;
  webVital?: WebVitals;
  withProfiles?: boolean;
};

export const useTransactionSamplesWebVitalsQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
  withProfiles,
  sortName,
  webVital,
}: Props) => {
  const shouldUseStoredScores = useStoredScoresSetting();
  const storedScoresResult = useTransactionSamplesWebVitalsScoresQuery({
    orderBy,
    limit,
    transaction,
    query,
    withProfiles,
    enabled: shouldUseStoredScores && enabled,
    sortName,
    webVital,
  });
  const rawWebVitalsResult = useTransactionRawSamplesWebVitalsQuery({
    orderBy,
    limit,
    transaction,
    query,
    withProfiles,
    enabled: !shouldUseStoredScores && enabled,
    sortName,
  });
  if (shouldUseStoredScores) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
