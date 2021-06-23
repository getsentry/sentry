import {mountWithTheme} from 'sentry-test/enzyme';

import ReleaseStore from 'app/stores/releaseStore';
import withRelease from 'app/utils/withRelease';

describe('withRelease HoC', function () {
  const organization = TestStubs.Organization();
  const orgSlug = organization.slug;
  const projectSlug = 'myProject';
  const releaseVersion = 'myRelease';

  const releaseUrl = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/`;
  const deployUrl = `/organizations/${orgSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/deploys/`;

  const api = new MockApiClient();
  const mockData = {id: '1'};

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: releaseUrl,
      body: mockData,
    });
    MockApiClient.addMockResponse({
      url: deployUrl,
      body: [mockData],
    });

    jest.restoreAllMocks();
    ReleaseStore.reset();
  });

  it('adds release/deploys prop', async () => {
    const Component = () => null;
    const Container = withRelease(Component);
    const wrapper = mountWithTheme(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );

    await tick(); // Run Store.loadEtc
    await tick(); // Run Store.loadEtcSuccess
    wrapper.update();

    const mountedComponent = wrapper.find(Component);
    expect(mountedComponent.prop('release')).toEqual(mockData);
    expect(mountedComponent.prop('releaseLoading')).toEqual(false);
    expect(mountedComponent.prop('releaseError')).toEqual(undefined);
    expect(mountedComponent.prop('deploys')).toEqual([mockData]);
    expect(mountedComponent.prop('deploysLoading')).toEqual(false);
    expect(mountedComponent.prop('deploysError')).toEqual(undefined);
  });

  it('prevents repeated calls', async () => {
    const Component = () => null;
    const Container = withRelease(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'fetchRelease');
    jest.spyOn(Container.prototype, 'fetchDeploys');

    // Mount and run component
    mountWithTheme(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );
    await tick();
    await tick();

    // Mount and run duplicates
    mountWithTheme(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );
    await tick();
    mountWithTheme(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(2); // 1 for fetchRelease, 1 for fetchDeploys
    expect(Container.prototype.fetchRelease).toHaveBeenCalledTimes(3);
    expect(Container.prototype.fetchDeploys).toHaveBeenCalledTimes(3);
  });
});
