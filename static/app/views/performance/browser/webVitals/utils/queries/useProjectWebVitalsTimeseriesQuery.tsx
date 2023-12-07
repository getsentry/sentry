import {Sort} from 'sentry/utils/discover/fields';
import {USE_STORED_SCORES} from 'sentry/views/performance/browser/webVitals/settings';
import {useProjectRawWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsTimeseriesQuery';
import {useProjectWebVitalsScoresTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

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
    enabled: USE_STORED_SCORES,
  });
  const rawWebVitalsResult = useProjectRawWebVitalsTimeseriesQuery({
    transaction,
    enabled: !USE_STORED_SCORES,
  });
  if (USE_STORED_SCORES) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
