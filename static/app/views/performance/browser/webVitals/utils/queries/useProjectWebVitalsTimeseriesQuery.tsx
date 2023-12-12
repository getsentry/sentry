import {Sort} from 'sentry/utils/discover/fields';
import {useProjectRawWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsTimeseriesQuery';
import {useProjectWebVitalsScoresTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';

type Props = {
  defaultSort?: Sort;
  limit?: number;
  orderBy?: WebVitals | null;
  sortName?: string;
  transaction?: string | null;
};

export const useProjectWebVitalsTimeseriesQuery = ({transaction}: Props) => {
  const shouldUseStoredScores = useStoredScoresSetting();
  const storedScoresResult = useProjectWebVitalsScoresTimeseriesQuery({
    transaction,
    enabled: shouldUseStoredScores,
  });
  const rawWebVitalsResult = useProjectRawWebVitalsTimeseriesQuery({
    transaction,
    enabled: !shouldUseStoredScores,
  });
  if (shouldUseStoredScores) {
    return storedScoresResult;
  }
  return rawWebVitalsResult;
};
