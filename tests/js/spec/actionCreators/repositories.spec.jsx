import {getRepositories} from 'app/actionCreators/repositories';
import RepositoryActions from 'app/actions/repositoryActions';
import RepositoryStore from 'app/stores/repositoryStore';

describe('RepositoryActionCreator', function() {
  const orgSlug = 'myOrg';
  const repoUrl = `/organizations/${orgSlug}/repos/`;

  const api = new MockApiClient();
  const mockData = [{id: '1'}];
  let mockResponse;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockResponse = MockApiClient.addMockResponse({
      url: repoUrl,
      body: mockData,
    });

    jest.restoreAllMocks();
    jest.spyOn(RepositoryActions, 'loadRepositories');
    jest.spyOn(RepositoryActions, 'loadRepositoriesSuccess');

    RepositoryStore.init();
  });

  it('fetches a Repository and emits actions', async () => {
    getRepositories(api, {orgSlug}); // Fire loadRepositories
    expect(RepositoryActions.loadRepositories).toHaveBeenCalledWith(orgSlug);
    expect(RepositoryActions.loadRepositoriesSuccess).not.toHaveBeenCalled();

    await tick(); // Run loadRepositories and fire loadRepositoriesSuccess
    expect(mockResponse).toHaveBeenCalledWith(repoUrl, expect.anything());
    expect(RepositoryActions.loadRepositoriesSuccess).toHaveBeenCalledWith(mockData);
    expect(RepositoryStore.state.orgSlug).toEqual(orgSlug);
    expect(RepositoryStore.state.repositories).toEqual(undefined);
    expect(RepositoryStore.state.repositoriesLoading).toEqual(true);

    await tick(); // Run loadRepositoriesSuccess
    expect(RepositoryStore.state.orgSlug).toEqual(orgSlug);
    expect(RepositoryStore.state.repositories).toEqual(mockData);
    expect(RepositoryStore.state.repositoriesLoading).toEqual(false);
  });

  it('short-circuits the JS event loop', async () => {
    expect(RepositoryStore.state.repositoriesLoading).toEqual(undefined);

    getRepositories(api, {orgSlug}); // Fire loadRepositories
    expect(RepositoryActions.loadRepositories).toHaveBeenCalled();
    expect(RepositoryStore.state.repositoriesLoading).toEqual(true); // Short-circuit

    await tick(); // Run loadRepositories and fire loadRepositoriesSuccess
    expect(RepositoryActions.loadRepositoriesSuccess).toHaveBeenCalled();
    expect(RepositoryStore.state.repositoriesLoading).toEqual(true);

    await tick(); // Run loadRepositoriesSuccess
    expect(RepositoryStore.state.repositoriesLoading).toEqual(false);
  });
});
