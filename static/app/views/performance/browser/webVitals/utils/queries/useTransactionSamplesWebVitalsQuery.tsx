import {useTransactionSamplesWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useTransactionSamplesWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

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
  const storedScoresResult = useTransactionSamplesWebVitalsScoresQuery({
    orderBy,
    limit,
    transaction,
    query,
    withProfiles,
    enabled,
    sortName,
    webVital,
  });
  return storedScoresResult;
};
