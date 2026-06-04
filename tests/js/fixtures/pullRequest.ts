import {RepositoryFixture} from 'sentry-fixture/repository';

import type {PullRequest} from 'sentry/types/integrations';

export function PullRequestFixture(params: Partial<PullRequest> = {}): PullRequest {
  return {
    id: '3',
    repository: RepositoryFixture(),
    title: 'Fix first issue',
    message: null,
    dateCreated: '2024-01-01T00:00:00.000000Z',
    externalUrl: 'https://example.github.com/example/repo-name/pulls/3',
    ...params,
  };
}
