import type {ReplayError as TReplayError} from 'sentry/views/replays/types';

export function ReplayError(
  error: Partial<TReplayError> & Pick<TReplayError, 'id' | 'issue' | 'timestamp'>
): TReplayError {
  return {
    'error.type': error['error.type'] ?? ([] as string[]),
    'error.value': error['error.value'] ?? ([] as string[]),
    id: error.id,
    issue: error.issue,
    'issue.id': error['issue.id'] ?? 3740335939,
    'project.name': error['project.name'] ?? 'javascript',
    timestamp: error.timestamp,
    title: error.title ?? 'A Redirect with :orgId param on customer domain',
  };
}
