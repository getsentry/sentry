import type {Sort} from 'sentry/utils/discover/fields';
import {useProjectWebVitalsScoresTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  defaultSort?: Sort;
  limit?: number;
  orderBy?: WebVitals | null;
  sortName?: string;
  transaction?: string | null;
};

export const useProjectWebVitalsTimeseriesQuery = ({transaction}: Props) => {
  const storedScoresResult = useProjectWebVitalsScoresTimeseriesQuery({
    transaction,
  });
  return storedScoresResult;
};
