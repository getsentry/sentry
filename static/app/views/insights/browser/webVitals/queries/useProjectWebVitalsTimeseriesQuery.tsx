import type {Sort} from 'sentry/utils/discover/fields';
import {useProjectWebVitalsScoresTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

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
