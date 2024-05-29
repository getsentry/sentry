import {RepositoryFixture} from 'sentry-fixture/repository';

import RepositoryStore from './repositoryStore';

describe('RepositoryStore', () => {
  beforeEach(() => {
    RepositoryStore.resetRepositories();
  });

  it('should load repositories', () => {
    const repositories = [
      RepositoryFixture({id: '1', name: 'repo1'}),
      RepositoryFixture({id: '2', name: 'repo2'}),
    ];
    RepositoryStore.loadRepositoriesSuccess(repositories);
    const state = RepositoryStore.get();
    expect(state.repositories).toEqual(repositories);
    expect(state.repositoriesLoading).toBeFalsy();
    expect(state.repositoriesError).toBeUndefined();
  });

  it('should handle error when loading repositories', () => {
    const error = new Error('Failed to load repositories');
    RepositoryStore.loadRepositoriesError(error);
    const state = RepositoryStore.get();
    expect(state.repositories).toBeUndefined();
    expect(state.repositoriesLoading).toBeFalsy();
    expect(state.repositoriesError).toEqual(error);
  });

  it('returns a stable reference with getState', () => {
    const repositories = [
      RepositoryFixture({id: '1', name: 'repo1'}),
      RepositoryFixture({id: '2', name: 'repo2'}),
    ];
    RepositoryStore.loadRepositoriesSuccess(repositories);
    const state = RepositoryStore.getState();
    expect(Object.is(state, RepositoryStore.getState())).toBe(true);
  });
});
