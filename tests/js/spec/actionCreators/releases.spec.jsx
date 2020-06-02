import {getRelease, getReleaseDeploys} from 'app/actionCreators/releases';
import ReleaseActions from 'app/actions/releaseActions';

describe('ReleaseActionCreator', function() {
  const api = new MockApiClient();
  const orgSlug = 'myOrg';
  const projectSlug = 'myProject';
  const releaseVersion = 'myRelease';

  const releaseUrl = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/`;
  const deployUrl = `/organizations/${orgSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/deploys/`;
  const mockData = {id: '1'};

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.spyOn(ReleaseActions, 'loadRelease');
    jest.spyOn(ReleaseActions, 'loadReleaseSuccess');
    jest.spyOn(ReleaseActions, 'loadDeploys');
    jest.spyOn(ReleaseActions, 'loadDeploysSuccess');
  });

  afterEach(function() {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('fetch a Release and emit an action', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: releaseUrl,
      body: mockData,
    });

    getRelease(api, {orgSlug, projectSlug, releaseVersion});
    await tick();

    expect(mockResponse).toHaveBeenCalledWith(releaseUrl, expect.anything());
    expect(ReleaseActions.loadRelease).toHaveBeenCalledWith(
      orgSlug,
      projectSlug,
      releaseVersion
    );
    expect(ReleaseActions.loadReleaseSuccess).toHaveBeenCalledWith(
      projectSlug,
      releaseVersion,
      mockData
    );
  });

  it('fetch Deploys and emit an action', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: deployUrl,
      body: mockData,
    });

    getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
    await tick();

    expect(mockResponse).toHaveBeenCalledWith(deployUrl, expect.anything());
    expect(ReleaseActions.loadDeploys).toHaveBeenCalledWith(
      orgSlug,
      projectSlug,
      releaseVersion
    );
    expect(ReleaseActions.loadDeploysSuccess).toHaveBeenCalledWith(
      projectSlug,
      releaseVersion,
      mockData
    );
  });
});
