import {Organization} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import RepositoryStore from 'sentry/stores/repositoryStore';
import withRepositories from 'sentry/utils/withRepositories';

describe('withRepositories HoC', function () {
  const organization = Organization();
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
    RepositoryStore.init?.();
  });

  it('adds repositories prop', async function () {
    const Component = jest.fn(() => null);
    const Container = withRepositories(Component);
    render(<Container api={api} organization={organization} />);

    await waitFor(() =>
      expect(Component).toHaveBeenCalledWith(
        expect.objectContaining({
          repositories: mockData,
          repositoriesLoading: false,
          repositoriesError: undefined,
        }),
        {}
      )
    );
  });

  it('prevents repeated calls', function () {
    function Component() {
      return null;
    }
    const Container = withRepositories(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'fetchRepositories');

    // Mount and run component
    render(<Container api={api} organization={organization} />);

    // Mount and run duplicates
    render(<Container api={api} organization={organization} />);
    render(<Container api={api} organization={organization} />);

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
  it('prevents simultaneous calls', function () {
    function Component() {
      return null;
    }
    const Container = withRepositories(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'componentDidMount');

    // Mount and run duplicates
    render(<Container api={api} organization={organization} />);
    render(<Container api={api} organization={organization} />);
    render(<Container api={api} organization={organization} />);

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
  });
});
