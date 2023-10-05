import {Organization} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ReleaseStore from 'sentry/stores/releaseStore';
import withRelease from 'sentry/utils/withRelease';

describe('withRelease HoC', function () {
  const organization = Organization();
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

  it('adds release/deploys prop', async function () {
    const Component = jest.fn(() => null);
    const Container = withRelease(Component);
    render(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );

    await waitFor(() =>
      expect(Component).toHaveBeenCalledWith(
        expect.objectContaining({
          release: mockData,
          releaseLoading: false,
          releaseError: undefined,
          deploys: [mockData],
          deploysLoading: false,
          deploysError: undefined,
        }),
        {}
      )
    );
  });

  it('prevents repeated calls', function () {
    const Component = jest.fn(() => null);
    const Container = withRelease(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'fetchRelease');
    jest.spyOn(Container.prototype, 'fetchDeploys');

    // Mount and run component
    render(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );

    // Mount and run duplicates
    render(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );

    render(
      <Container
        api={api}
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={releaseVersion}
      />
    );

    expect(api.requestPromise).toHaveBeenCalledTimes(2); // 1 for fetchRelease, 1 for fetchDeploys
    expect(Container.prototype.fetchRelease).toHaveBeenCalledTimes(3);
    expect(Container.prototype.fetchDeploys).toHaveBeenCalledTimes(3);
  });
});
