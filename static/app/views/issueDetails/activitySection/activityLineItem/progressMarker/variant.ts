import {t} from 'sentry/locale';
import type {ProgressState} from 'sentry/types/group';
import {formatProgressState} from 'sentry/views/issueList/utils/progress';

export type ActivityMarkerState = ProgressState | 'activity';

export function formatActivityMarkerState(state: ActivityMarkerState) {
  if (state === 'activity') {
    return t('Activity update');
  }

  return formatProgressState(state);
}
