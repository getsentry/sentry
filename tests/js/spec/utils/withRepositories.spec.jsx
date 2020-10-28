import React from 'react';

import {mount} from 'sentry-test/enzyme';

import RepositoryStore from 'app/stores/repositoryStore';
import withRepositories from 'app/utils/withRepositories';

describe('withRepositories HoC', function () {
  const orgSlug = 'myOrg';
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
    const wrapper = mount(<Container api={api} orgSlug={orgSlug} />);

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

    // XXX(leedongwei): We cannot spy on `fetchRepositories` as Jest can't
    // replace the method in the prototype due to createReactClass.
    // As such, I'm using `componentDidMount` as a proxy.
    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'componentDidMount');
    // jest.spyOn(Container.prototype, 'fetchRepositories');

    // Mount and run component
    mount(<Container api={api} orgSlug={orgSlug} />);
    await tick();
    await tick();

    // Mount and run duplicates
    mount(<Container api={api} orgSlug={orgSlug} />);
    await tick();
    mount(<Container api={api} orgSlug={orgSlug} />);
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
    // expect(Container.prototype.fetchRepositories).toHaveBeenCalledTimes(3);
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
    mount(<Container api={api} orgSlug={orgSlug} />);
    mount(<Container api={api} orgSlug={orgSlug} />);
    mount(<Container api={api} orgSlug={orgSlug} />);

    await tick();
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
  });
});
