import {getRepositories} from 'app/actionCreators/repositories';
import RepositoryActions from 'app/actions/repositoryActions';
import RepositoryStore from 'app/stores/repositoryStore';

describe('RepositoryActionCreator', function () {
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

    RepositoryStore.resetRepositories();

    jest.restoreAllMocks();
    jest.spyOn(RepositoryActions, 'loadRepositories');
    jest.spyOn(RepositoryActions, 'loadRepositoriesSuccess');

    /**
     * XXX(leedongwei): We would want to ensure that Store methods are not
     * called to be 100% sure that the short-circuit is happening correctly.
     *
     * However, it seems like we cannot attach a listener to the method
     * See: https://github.com/reflux/refluxjs/issues/139#issuecomment-64495623
     */
    // jest.spyOn(RepositoryStore, 'loadRepositories');
    // jest.spyOn(RepositoryStore, 'loadRepositoriesSuccess');
  });

  /**
   * XXX(leedongwei): I wanted to separate the ticks and run tests to assert the
   * state change at every tick but it is incredibly flakey.
   */
  it('fetches a Repository and emits actions', async () => {
    getRepositories(api, {orgSlug}); // Fire Action.loadRepositories
    expect(RepositoryActions.loadRepositories).toHaveBeenCalledWith(orgSlug);
    expect(RepositoryActions.loadRepositoriesSuccess).not.toHaveBeenCalled();

    await tick(); // Run Store.loadRepositories and fire Action.loadRepositoriesSuccess
    await tick(); // Run Store.loadRepositoriesSuccess

    expect(mockResponse).toHaveBeenCalledWith(repoUrl, expect.anything());
    expect(RepositoryActions.loadRepositoriesSuccess).toHaveBeenCalledWith(mockData);

    expect(RepositoryStore.state.orgSlug).toEqual(orgSlug);
    expect(RepositoryStore.state.repositories).toEqual(mockData);
    expect(RepositoryStore.state.repositoriesLoading).toEqual(false);
  });

  it('short-circuits the JS event loop', async () => {
    expect(RepositoryStore.state.repositoriesLoading).toEqual(undefined);

    getRepositories(api, {orgSlug}); // Fire Action.loadRepositories
    expect(RepositoryActions.loadRepositories).toHaveBeenCalled();
    // expect(RepositoryStore.loadRepositories).not.toHaveBeenCalled();
    expect(RepositoryStore.state.repositoriesLoading).toEqual(true); // Short-circuit
  });
});
