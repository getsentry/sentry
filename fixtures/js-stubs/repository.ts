import {Repository as RepositoryType, RepositoryStatus} from 'sentry/types';

export function Repository(params: Partial<RepositoryType> = {}): RepositoryType {
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
