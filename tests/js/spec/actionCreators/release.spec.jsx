import {getProjectRelease, getReleaseDeploys} from 'app/actionCreators/release';
import ReleaseActions from 'app/actions/releaseActions';
import ReleaseStore, {getReleaseStoreKey} from 'app/stores/releaseStore';

describe('ReleaseActionCreator', function() {
  const orgSlug = 'myOrg';
  const projectSlug = 'myProject';
  const releaseVersion = 'myRelease';
  const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);

  const api = new MockApiClient();
  const mockData = {id: '1'};
  let mockReponse;

  describe('getProjectRelease', () => {
    const releaseUrl = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
      releaseVersion
    )}/`;

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      mockReponse = MockApiClient.addMockResponse({
        url: releaseUrl,
        body: mockData,
      });

      ReleaseStore.reset();

      jest.restoreAllMocks();
      jest.spyOn(ReleaseActions, 'loadRelease');
      jest.spyOn(ReleaseActions, 'loadReleaseSuccess');

      // XXX(leedongwei): See repositories.spec.jsx for the reason that we
      // cannot spy on ReleaseStore at all
    });

    it('fetches a Release and emits actions', async () => {
      getProjectRelease(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseActions.loadRelease).toHaveBeenCalledWith(
        orgSlug,
        projectSlug,
        releaseVersion
      );
      expect(ReleaseActions.loadReleaseSuccess).not.toHaveBeenCalled();

      await tick(); // Run Store.loadRelease and fire Action.loadReleaseSuccess
      await tick(); // Run Store.loadReleaseSuccess

      expect(mockReponse).toHaveBeenCalledWith(releaseUrl, expect.anything());
      expect(ReleaseActions.loadReleaseSuccess).toHaveBeenCalledWith(
        projectSlug,
        releaseVersion,
        mockData
      );

      expect(ReleaseStore.state.release[releaseKey]).toEqual(mockData);
      expect(ReleaseStore.state.releaseLoading[releaseKey]).toEqual(false);
      expect(ReleaseStore.state.releaseError[releaseKey]).toEqual(undefined);
    });

    it('short-circuits the JS event loop when fetching Release', async () => {
      expect(ReleaseStore.state.releaseLoading[releaseKey]).toEqual(undefined);

      getProjectRelease(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseActions.loadRelease).toHaveBeenCalled();
      // expect(ReleaseStore.loadRelease).not.toHaveBeenCalled();
      expect(ReleaseStore.state.releaseLoading[releaseKey]).toEqual(true);
    });
  });

  describe('getReleaseDeploys', () => {
    const deploysUrl = `/organizations/${orgSlug}/releases/${encodeURIComponent(
      releaseVersion
    )}/deploys/`;

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      mockReponse = MockApiClient.addMockResponse({
        url: deploysUrl,
        body: [mockData],
      });

      ReleaseStore.reset();

      jest.restoreAllMocks();
      jest.spyOn(ReleaseActions, 'loadDeploys');
      jest.spyOn(ReleaseActions, 'loadDeploysSuccess');
    });

    it('fetch Deploys and emit an action', async () => {
      getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseActions.loadDeploys).toHaveBeenCalledWith(
        orgSlug,
        projectSlug,
        releaseVersion
      );
      expect(ReleaseActions.loadDeploysSuccess).not.toHaveBeenCalled();

      await tick(); // Run Store.loadDeploys and fire Action.loadDeploysSuccess
      await tick(); // Run Store.loadDeploysSuccess

      expect(mockReponse).toHaveBeenCalledWith(deploysUrl, expect.anything());
      expect(ReleaseActions.loadDeploysSuccess).toHaveBeenCalledWith(
        projectSlug,
        releaseVersion,
        [mockData]
      );

      expect(ReleaseStore.state.deploys[releaseKey]).toEqual([mockData]);
      expect(ReleaseStore.state.deploysLoading[releaseKey]).toEqual(false);
      expect(ReleaseStore.state.deploysError[releaseKey]).toEqual(undefined);
    });

    it('short-circuits the JS event loop when fetching Release', async () => {
      expect(ReleaseStore.state.deploysLoading[releaseKey]).toEqual(undefined);

      getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
      expect(ReleaseActions.loadDeploys).toHaveBeenCalled();
      // expect(ReleaseStore.loadDeploys).not.toHaveBeenCalled(); // See comment for Release
      expect(ReleaseStore.state.deploysLoading[releaseKey]).toEqual(true);
    });
  });
});
