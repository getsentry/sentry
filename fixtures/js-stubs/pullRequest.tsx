import {Repository} from 'sentry-fixture/repository';

import {PullRequest as PullRequestType} from 'sentry/types';

export function PullRequest(params: Partial<PullRequestType> = {}): PullRequestType {
  return {
    id: '3',
    repository: Repository(),
    title: 'Fix first issue',
    externalUrl: 'https://example.github.com/example/repo-name/pulls/3',
    ...params,
  };
}
