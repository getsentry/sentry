import {RepositoryFixture} from 'sentry-fixture/repository';

import {PullRequest as PullRequestType} from 'sentry/types';

export function PullRequestFixture(
  params: Partial<PullRequestType> = {}
): PullRequestType {
  return {
    id: '3',
    repository: RepositoryFixture(),
    title: 'Fix first issue',
    externalUrl: 'https://example.github.com/example/repo-name/pulls/3',
    ...params,
  };
}
