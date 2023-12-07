import {USE_STORED_SCORES} from 'sentry/views/performance/browser/webVitals/settings';
import {useTransactionRawSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useTransactionRawSamplesWebVitalsQuery';
import {useTransactionSamplesWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionSamplesWebVitalsScoresQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  transaction: string;
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  withProfiles?: boolean;
};

export const useTransactionSamplesWebVitalsQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
  withProfiles,
}: Props) => {
  const storedScoresResult = useTransactionSamplesWebVitalsScoresQuery({
    orderBy,
    limit,
    transaction,
    query,
    withProfiles,
    enabled: enabled && USE_STORED_SCORES,
  });
  const rawWebVitalsResult = useTransactionRawSamplesWebVitalsQuery({
    orderBy,
    limit,
    transaction,
    query,
    withProfiles,
    enabled: enabled && !USE_STORED_SCORES,
  });
  if (USE_STORED_SCORES) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
