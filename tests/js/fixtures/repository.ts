import type {Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';

export function RepositoryFixture(params: Partial<Repository> = {}): Repository {
  return {
    id: '4',
    name: 'example/repo-name',
    provider: {id: '1', name: 'github'},
    url: 'https://github.com/example/repo-name',
    status: RepositoryStatus.ACTIVE,
    externalSlug: 'example/repo-name',
    externalId: '1',
    dateCreated: '',
    integrationId: '',
    ...params,
  };
}
