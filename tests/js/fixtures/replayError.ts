import type {ReplayError} from 'sentry/views/replays/types';

export function ReplayErrorFixture(
  error: Partial<ReplayError> & Pick<ReplayError, 'id' | 'issue' | 'timestamp'>
): ReplayError {
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
