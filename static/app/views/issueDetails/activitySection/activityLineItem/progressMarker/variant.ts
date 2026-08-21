import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType, ProgressState} from 'sentry/types/group';
import {formatProgressState} from 'sentry/views/issueList/utils/progress';

export type ActivityMarkerState = ProgressState | 'activity';

export function getActivityMarkerState(item: GroupActivity): ActivityMarkerState {
  switch (item.type) {
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
    case GroupActivityType.PULL_REQUEST_REOPENED:
    case GroupActivityType.REFERENCED_IN_COMMIT:
    case GroupActivityType.SEER_PR_CREATED:
      return ProgressState.FIX_PROPOSED;
    case GroupActivityType.SET_RESOLVED:
    case GroupActivityType.SET_RESOLVED_BY_AGE:
    case GroupActivityType.SET_RESOLVED_IN_RELEASE:
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
    case GroupActivityType.PULL_REQUEST_MERGED:
      return ProgressState.FIX_APPLIED;
    case GroupActivityType.SET_ESCALATING:
    case GroupActivityType.SEER_RCA_COMPLETED:
      return ProgressState.DIAGNOSED;
    case GroupActivityType.SEER_RCA_STARTED:
    case GroupActivityType.SEER_SOLUTION_STARTED:
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
    case GroupActivityType.SEER_CODING_STARTED:
    case GroupActivityType.SEER_CODING_COMPLETED:
    case GroupActivityType.SEER_ITERATION_STARTED:
    case GroupActivityType.SEER_ITERATION_COMPLETED:
    case GroupActivityType.TRIGGER_AUTOFIX:
    case GroupActivityType.CREATE_ISSUE:
    case GroupActivityType.SET_PUBLIC:
    case GroupActivityType.SET_PRIVATE:
    case GroupActivityType.SET_PRIORITY:
    case GroupActivityType.DELETED_ATTACHMENT:
    case GroupActivityType.MERGE:
    case GroupActivityType.UNMERGE_SOURCE:
    case GroupActivityType.UNMERGE_DESTINATION:
    case GroupActivityType.REPROCESS:
    case GroupActivityType.MARK_REVIEWED:
      return 'activity';
    case GroupActivityType.SET_REGRESSION:
      return ProgressState.IDENTIFIED;
    case GroupActivityType.SET_IGNORED:
      return ProgressState.ASSIGNED;
    case GroupActivityType.SET_UNRESOLVED:
      return 'forecast' in item.data && item.data.forecast
        ? ProgressState.DIAGNOSED
        : ProgressState.IDENTIFIED;
    case GroupActivityType.NOTE:
      return 'activity';
    case GroupActivityType.ASSIGNED:
    case GroupActivityType.UNASSIGNED:
      return ProgressState.ASSIGNED;
    default:
      return ProgressState.IDENTIFIED;
  }
}

export function formatActivityMarkerState(state: ActivityMarkerState) {
  if (state === 'activity') {
    return t('Activity update');
  }

  return formatProgressState(state);
}
