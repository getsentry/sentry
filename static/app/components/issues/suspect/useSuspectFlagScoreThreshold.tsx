import {SUSPECT_SCORE_THRESHOLD} from 'sentry/components/issues/suspect/constants';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const SUSPECT_SCORE_LOCAL_STATE_KEY = 'flag-drawer-suspicion-score-threshold';

export default function useSuspectFlagScoreThreshold() {
  return useLocalStorageState(SUSPECT_SCORE_LOCAL_STATE_KEY, SUSPECT_SCORE_THRESHOLD);
}
