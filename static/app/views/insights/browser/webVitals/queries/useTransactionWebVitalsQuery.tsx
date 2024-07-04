import type {Sort} from 'sentry/utils/discover/fields';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/components/browserTypeSelector';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

type Props = {
  browserType?: BrowserType;
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
  browserType,
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
    browserType,
  });
  return storedScoresResult;
};
