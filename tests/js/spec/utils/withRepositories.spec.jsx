import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import RepositoryActions from 'app/actions/repositoryActions';
import OrganizationStore from 'app/stores/organizationStore';
import RepositoryStore from 'app/stores/repositoryStore';
import withRepositories from 'app/utils/withRepositories';

describe('withRepositories HoC', function () {
  const organization = TestStubs.Organization();
  const orgSlug = organization.slug;
  const repoUrl = `/organizations/${orgSlug}/repos/`;

  const mockData = [{id: '1'}];

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: repoUrl,
      body: mockData,
    });

    act(() => RepositoryStore.init());
    act(() => OrganizationStore.init());
    jest.spyOn(RepositoryActions, 'loadRepositories');
    jest.spyOn(RepositoryActions, 'loadRepositoriesSuccess');
  });

  afterEach(function () {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('adds repositories prop', async () => {
    const Component = () => null;
    OrganizationStore.onUpdate(organization);
    const Container = withRepositories(Component);

    const wrapper = mountWithTheme(<Container />);

    await act(tick);
    wrapper.update(); // Re-render component with Store data

    const mountedComponent = wrapper.find(Component);
    expect(mountedComponent.prop('repositories')).toEqual(mockData);
    expect(mountedComponent.prop('repositoriesLoading')).toEqual(false);
    expect(mountedComponent.prop('repositoriesError')).toEqual(null);
  });

  it('prevents repeated calls', async () => {
    const Component = () => null;
    act(() => OrganizationStore.onUpdate(organization));

    const Container = withRepositories(Component);

    // Mount and run component
    mountWithTheme(<Container />);
    await act(tick);
    await act(tick);

    // // Mount and run duplicates
    mountWithTheme(<Container />);
    await act(tick);
    mountWithTheme(<Container />);
    await act(tick);
    expect(RepositoryActions.loadRepositories).toHaveBeenCalledTimes(1);
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
    act(() => OrganizationStore.onUpdate(organization));

    const Container = withRepositories(Component);

    // Mount and run duplicates
    mountWithTheme(<Container />);
    mountWithTheme(<Container />);
    mountWithTheme(<Container />);

    await act(tick);
    await act(tick);
    await act(tick);

    expect(RepositoryActions.loadRepositoriesSuccess).toHaveBeenCalledTimes(1);
  });
});
