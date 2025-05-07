import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {SUSPECT_SCORE_THRESHOLD} from 'sentry/views/issueDetails/suspect/consts';

const SUSPECT_SCORE_LOCAL_STATE_KEY = 'flag-drawer-suspicion-score-threshold';

export default function useSuspectFlagScoreThreshold() {
  return useLocalStorageState(SUSPECT_SCORE_LOCAL_STATE_KEY, SUSPECT_SCORE_THRESHOLD);
}
