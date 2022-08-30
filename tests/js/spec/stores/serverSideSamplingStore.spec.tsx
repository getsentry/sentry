import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';

import {
  mockedSamplingDistribution,
  mockedSamplingSdkVersions,
} from '../views/settings/project/server-side-sampling/utils';

describe('ServerSideSamplingStore', function () {
  beforeEach(function () {
    ServerSideSamplingStore.reset();
  });

  afterEach(function () {
    jest.restoreAllMocks();
  });

  describe('fetchDistributionSuccess()', function () {
    it('should load new sampling distribution values and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().distribution.data).toEqual(undefined);

      ServerSideSamplingStore.fetchDistributionSuccess(mockedSamplingDistribution);

      expect(ServerSideSamplingStore.getState().distribution.data).toEqual(
        mockedSamplingDistribution
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchSdkVersionsSuccess()', function () {
    it('should load new sdk version values and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().sdkVersions.data).toEqual(undefined);

      ServerSideSamplingStore.fetchSdkVersionsSuccess(mockedSamplingSdkVersions);

      expect(ServerSideSamplingStore.getState().sdkVersions.data).toEqual(
        mockedSamplingSdkVersions
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchProjectStats48hSuccess()', function () {
    it('should load project stats from the last 48h and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().projectStats48h.data).toEqual(undefined);

      ServerSideSamplingStore.fetchProjectStats48hSuccess(TestStubs.Outcomes());

      expect(ServerSideSamplingStore.getState().projectStats48h.data).toEqual(
        TestStubs.Outcomes()
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchProjectStats30dSuccess()', function () {
    it('should load project stats from the last 30d and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().projectStats30d.data).toEqual(undefined);

      ServerSideSamplingStore.fetchProjectStats30dSuccess(TestStubs.Outcomes());

      expect(ServerSideSamplingStore.getState().projectStats30d.data).toEqual(
        TestStubs.Outcomes()
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
