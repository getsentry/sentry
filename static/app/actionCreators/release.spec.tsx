import {getProjectRelease, getReleaseDeploys} from 'sentry/actionCreators/release';
import ReleaseStore, {getReleaseStoreKey} from 'sentry/stores/releaseStore';

describe('ReleaseActionCreator', function () {
  const orgSlug = 'myOrg';
  const projectSlug = 'myProject';
  const releaseVersion = 'myRelease';
  const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

  const api = new MockApiClient();
  const mockData = {id: '1'};
  let mockResponse: jest.Mock;

  describe('getProjectRelease', () => {
    const releaseUrl = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
      releaseVersion
    )}/`;

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      mockResponse = MockApiClient.addMockResponse({
        url: releaseUrl,
        body: mockData,
      });

      ReleaseStore.reset();

      jest.restoreAllMocks();
      jest.spyOn(ReleaseStore, 'loadRelease');
      jest.spyOn(ReleaseStore, 'loadReleaseSuccess');

      // XXX(leedongwei): We cannot spy on ReleaseStore at all
      // See repositories.spec.jsx beforeEach method for the reason
    });

    it('fetches a Release and emits actions', async () => {
      getProjectRelease(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseStore.loadRelease).toHaveBeenCalledWith(
        orgSlug,
        projectSlug,
        releaseVersion
      );
      expect(ReleaseStore.loadReleaseSuccess).not.toHaveBeenCalled();

      await tick(); // Run Store.loadRelease and fire Action.loadReleaseSuccess
      await tick(); // Run Store.loadReleaseSuccess

      expect(mockResponse).toHaveBeenCalledWith(releaseUrl, expect.anything());
      expect(ReleaseStore.loadReleaseSuccess).toHaveBeenCalledWith(
        projectSlug,
        releaseVersion,
        mockData
      );

      expect(ReleaseStore.state.release[releaseKey]).toEqual(mockData);
      expect(ReleaseStore.state.releaseLoading[releaseKey]).toEqual(false);
      expect(ReleaseStore.state.releaseError[releaseKey]).toEqual(undefined);
    });

    it('short-circuits the JS event loop when fetching Release', () => {
      expect(ReleaseStore.state.releaseLoading[releaseKey]).toEqual(undefined);

      getProjectRelease(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseStore.loadRelease).toHaveBeenCalled();
      // expect(ReleaseStore.loadRelease).not.toHaveBeenCalled(); // See above for comment on ReleaseStore
      expect(ReleaseStore.state.releaseLoading[releaseKey]).toEqual(true);
    });
  });

  describe('getReleaseDeploys', () => {
    const deploysUrl = `/organizations/${orgSlug}/releases/${encodeURIComponent(
      releaseVersion
    )}/deploys/`;

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      mockResponse = MockApiClient.addMockResponse({
        url: deploysUrl,
        body: [mockData],
      });

      ReleaseStore.reset();

      jest.restoreAllMocks();
      jest.spyOn(ReleaseStore, 'loadDeploys');
      jest.spyOn(ReleaseStore, 'loadDeploysSuccess');
    });

    it('fetch Deploys and emit an action', async () => {
      getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseStore.loadDeploys).toHaveBeenCalledWith(
        orgSlug,
        projectSlug,
        releaseVersion
      );
      expect(ReleaseStore.loadDeploysSuccess).not.toHaveBeenCalled();

      await tick(); // Run Store.loadDeploys and fire Action.loadDeploysSuccess
      await tick(); // Run Store.loadDeploysSuccess

      expect(mockResponse).toHaveBeenCalledWith(deploysUrl, expect.anything());
      expect(ReleaseStore.loadDeploysSuccess).toHaveBeenCalledWith(
        projectSlug,
        releaseVersion,
        [mockData]
      );

      expect(ReleaseStore.state.deploys[releaseKey]).toEqual([mockData]);
      expect(ReleaseStore.state.deploysLoading[releaseKey]).toEqual(false);
      expect(ReleaseStore.state.deploysError[releaseKey]).toEqual(undefined);
    });

    it('short-circuits the JS event loop when fetching Deploys', () => {
      expect(ReleaseStore.state.deploysLoading[releaseKey]).toEqual(undefined);

      getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseStore.loadDeploys).toHaveBeenCalled();
      // expect(ReleaseStore.loadDeploys).not.toHaveBeenCalled(); // See above for comment on ReleaseStore
      expect(ReleaseStore.state.deploysLoading[releaseKey]).toEqual(true);
    });
  });
});
