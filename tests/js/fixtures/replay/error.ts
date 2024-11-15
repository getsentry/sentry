import type {RawReplayError} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export function RawReplayErrorFixture(
  error: Overwrite<Partial<RawReplayError>, {timestamp: Date}>
): RawReplayError {
  return {
    'error.type': error['error.type'] ?? ([] as string[]),
    id: error.id ?? 'e123',
    issue: error.issue ?? 'JS-374',
    'issue.id': error['issue.id'] ?? 3740335939,
    'project.name': error['project.name'] ?? 'javascript',
    timestamp: error.timestamp.toISOString(),
    title: error.title ?? 'A Redirect with :orgId param on customer domain',
  };
}
