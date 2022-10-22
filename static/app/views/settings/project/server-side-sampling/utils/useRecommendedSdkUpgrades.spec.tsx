import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useRecommendedSdkUpgrades} from 'sentry/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades';

import {mockedSamplingSdkVersions} from '../testUtils';

describe('useRecommendedSdkUpgrades', function () {
  it('works', function () {
    ProjectsStore.loadInitialData([
      Project({id: '1', slug: 'sentry'}),
      Project({id: '2', slug: 'java'}),
      Project({id: '3', slug: 'angular'}),
      Project({id: '4', slug: 'javascript'}),
    ]);

    ServerSideSamplingStore.sdkVersionsRequestSuccess(mockedSamplingSdkVersions);

    const {result} = reactHooks.renderHook(useRecommendedSdkUpgrades, {
      initialProps: {organization: Organization(), projectId: '3'},
    });

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
    expect(result.current.incompatibleProjects.length).toBe(1);
    expect(result.current.incompatibleProjects).toEqual([
      expect.objectContaining({
        features: [],
        slug: 'angular',
      }),
    ]);
    expect(result.current.isProjectIncompatible).toBe(true);
    expect(result.current.affectedProjects.length).toBe(4);
  });
});
