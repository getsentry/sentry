import {Outcomes} from 'fixtures/js-stubs/outcomes.js';

import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {
  mockedSamplingDistribution,
  mockedSamplingSdkVersions,
} from 'sentry/views/settings/project/server-side-sampling/testUtils';

describe('ServerSideSamplingStore', function () {
  beforeEach(function () {
    ServerSideSamplingStore.reset();
  });

  afterEach(function () {
    jest.restoreAllMocks();
  });

  describe('distributionRequestSuccess()', function () {
    it('should load new sampling distribution values and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().distribution.data).toEqual(undefined);

      ServerSideSamplingStore.distributionRequestSuccess(mockedSamplingDistribution);

      expect(ServerSideSamplingStore.getState().distribution.data).toEqual(
        mockedSamplingDistribution
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('sdkVersionsRequestSuccess()', function () {
    it('should load new sdk version values and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().sdkVersions.data).toEqual(undefined);

      ServerSideSamplingStore.sdkVersionsRequestSuccess(mockedSamplingSdkVersions);

      expect(ServerSideSamplingStore.getState().sdkVersions.data).toEqual(
        mockedSamplingSdkVersions
      );

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('projectStats48hRequestSuccess()', function () {
    it('should load project stats from the last 48h and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().projectStats48h.data).toEqual(undefined);

      ServerSideSamplingStore.projectStats48hRequestSuccess(Outcomes());

      expect(ServerSideSamplingStore.getState().projectStats48h.data).toEqual(Outcomes());

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('projectStats30dRequestSuccess()', function () {
    it('should load project stats from the last 30d and trigger state', function () {
      jest.spyOn(ServerSideSamplingStore, 'trigger');

      expect(ServerSideSamplingStore.getState().projectStats30d.data).toEqual(undefined);

      ServerSideSamplingStore.projectStats30dRequestSuccess(Outcomes());

      expect(ServerSideSamplingStore.getState().projectStats30d.data).toEqual(Outcomes());

      expect(ServerSideSamplingStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
