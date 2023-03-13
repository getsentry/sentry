import type {ReplayError as TReplayError} from 'sentry/views/replays/types';

export function ReplayError(
  error: Partial<TReplayError> & Pick<TReplayError, 'id' | 'issue' | 'timestamp'>
): TReplayError {
  return {
    'error.type': [] as string[],
    'error.value': [] as string[],
    id: error.id,
    issue: error.issue,
    'issue.id': 3740335939,
    'project.name': 'javascript',
    timestamp: error.id,
    title: 'A Redirect with :orgId param on customer domain',
  };
}
