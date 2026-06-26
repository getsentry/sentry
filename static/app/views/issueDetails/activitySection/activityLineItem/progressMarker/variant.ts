import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';

export type ProgressMarkerVariant =
  | 'diagnosed'
  | 'dot'
  | 'fix-applied'
  | 'fix-proposed'
  | 'identified'
  | 'routed';

export function getProgressMarkerVariant(item: GroupActivity): ProgressMarkerVariant {
  switch (item.type) {
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
    case GroupActivityType.REFERENCED_IN_COMMIT:
    case GroupActivityType.SEER_PR_CREATED:
      return 'fix-proposed';
    case GroupActivityType.SET_RESOLVED:
    case GroupActivityType.SET_RESOLVED_BY_AGE:
    case GroupActivityType.SET_RESOLVED_IN_RELEASE:
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
    case GroupActivityType.MARK_REVIEWED:
      return 'fix-applied';
    case GroupActivityType.SET_ESCALATING:
    case GroupActivityType.SEER_RCA_COMPLETED:
      return 'diagnosed';
    case GroupActivityType.SEER_RCA_STARTED:
    case GroupActivityType.SEER_SOLUTION_STARTED:
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
    case GroupActivityType.SEER_CODING_STARTED:
    case GroupActivityType.SEER_CODING_COMPLETED:
    case GroupActivityType.SEER_ITERATION_STARTED:
    case GroupActivityType.SEER_ITERATION_COMPLETED:
    case GroupActivityType.CREATE_ISSUE:
    case GroupActivityType.SET_PUBLIC:
    case GroupActivityType.SET_PRIVATE:
    case GroupActivityType.SET_PRIORITY:
      return 'dot';
    case GroupActivityType.SET_REGRESSION:
      return 'identified';
    case GroupActivityType.SET_IGNORED:
      return 'routed';
    case GroupActivityType.SET_UNRESOLVED:
      return 'forecast' in item.data && item.data.forecast ? 'diagnosed' : 'identified';
    case GroupActivityType.NOTE:
      return 'dot';
    case GroupActivityType.ASSIGNED:
    case GroupActivityType.UNASSIGNED:
      return 'routed';
    default:
      return 'identified';
  }
}
