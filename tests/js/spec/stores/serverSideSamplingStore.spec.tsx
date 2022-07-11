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

  describe('loadSamplingDistributionSuccess()', function () {
    it('should load new sampling distribution values and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().samplingDistribution).toEqual({});

      ServerSideSamplingStore.loadSamplingDistributionSuccess(mockedSamplingDistribution);

      expect(ServerSideSamplingStore.getState().samplingDistribution).toEqual(
        mockedSamplingDistribution
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadSamplingSdkVersionsSuccess()', function () {
    it('should load new sdk version values and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().samplingSdkVersions).toEqual([]);

      ServerSideSamplingStore.loadSamplingSdkVersionsSuccess(mockedSamplingSdkVersions);

      expect(ServerSideSamplingStore.getState().samplingSdkVersions).toEqual(
        mockedSamplingSdkVersions
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
