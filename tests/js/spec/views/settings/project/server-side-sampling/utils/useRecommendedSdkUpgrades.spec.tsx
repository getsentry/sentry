import {reactHooks} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useRecommendedSdkUpgrades} from 'sentry/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades';

import {mockedSamplingSdkVersions} from '../utils';

describe('useRecommendedSdkUpgrades', function () {
  it('works', function () {
    ProjectsStore.loadInitialData([
      TestStubs.Project({id: 1, slug: 'sentry'}),
      TestStubs.Project({id: 2, slug: 'java'}),
    ]);
    ServerSideSamplingStore.loadSamplingSdkVersionsSuccess(mockedSamplingSdkVersions);

    const {result} = reactHooks.renderHook(() =>
      useRecommendedSdkUpgrades({orgSlug: 'org-slug'})
    );

    expect(result.current.recommendedSdkUpgrades.length).toBe(2);
    expect(result.current.recommendedSdkUpgrades).toEqual([
      {
        latestSDKName: 'sentry.java',
        latestSDKVersion: '1.0.2',
        project: expect.objectContaining({
          features: [],
          slug: 'java',
        }),
      },
      {
        latestSDKName: 'sentry.python',
        latestSDKVersion: '1.0.2',
        project: expect.objectContaining({
          features: [],
          slug: 'sentry',
        }),
      },
    ]);
  });
});
