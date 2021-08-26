import {mountWithTheme} from 'sentry-test/enzyme';

import RepositoryStore from 'app/stores/repositoryStore';
import withRepositories from 'app/utils/withRepositories';

describe('withRepositories HoC', function () {
  const organization = TestStubs.Organization();
  const orgSlug = organization.slug;
  const repoUrl = `/organizations/${orgSlug}/repos/`;

  const api = new MockApiClient();
  const mockData = [{id: '1'}];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: repoUrl,
      body: mockData,
    });

    jest.restoreAllMocks();
    RepositoryStore.init();
  });

  it('adds repositories prop', async () => {
    const Component = () => null;
    const Container = withRepositories(Component);
    const wrapper = mountWithTheme(<Container api={api} organization={organization} />);

    await tick(); // Run Store.loadRepositories
    await tick(); // Run Store.loadRepositoriesSuccess
    wrapper.update(); // Re-render component with Store data

    const mountedComponent = wrapper.find(Component);
    expect(mountedComponent.prop('repositories')).toEqual(mockData);
    expect(mountedComponent.prop('repositoriesLoading')).toEqual(false);
    expect(mountedComponent.prop('repositoriesError')).toEqual(undefined);
  });

  it('prevents repeated calls', async () => {
    const Component = () => null;
    const Container = withRepositories(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'fetchRepositories');

    // Mount and run component
    mountWithTheme(<Container api={api} organization={organization} />);
    await tick();
    await tick();

    // Mount and run duplicates
    mountWithTheme(<Container api={api} organization={organization} />);
    await tick();
    mountWithTheme(<Container api={api} organization={organization} />);
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.fetchRepositories).toHaveBeenCalledTimes(3);
  });

  /**
   * Same as 'prevents repeated calls', but with the async fetch/checks
   * happening on same tick.
   *
   * Additionally, this test checks that withRepositories.fetchRepositories does
   * not check for (store.orgSlug !== orgSlug) as the short-circuit does not
   * change the value for orgSlug
   */
  it('prevents simultaneous calls', async () => {
    const Component = () => null;
    const Container = withRepositories(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'componentDidMount');

    // Mount and run duplicates
    mountWithTheme(<Container api={api} organization={organization} />);
    mountWithTheme(<Container api={api} organization={organization} />);
    mountWithTheme(<Container api={api} organization={organization} />);

    await tick();
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
  });
});
