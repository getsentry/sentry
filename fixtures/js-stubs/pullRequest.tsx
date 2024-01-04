import {RepositoryFixture} from 'sentry-fixture/repository';

import {PullRequest} from 'sentry/types';

export function PullRequestFixture(params: Partial<PullRequest> = {}): PullRequest {
  return {
    id: '3',
    repository: RepositoryFixture(),
    title: 'Fix first issue',
    externalUrl: 'https://example.github.com/example/repo-name/pulls/3',
    ...params,
  };
}
