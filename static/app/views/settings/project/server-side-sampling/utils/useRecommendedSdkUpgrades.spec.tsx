import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useRecommendedSdkUpgrades} from 'sentry/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades';

import {
  getMockInitializeOrg,
  mockedSamplingDistribution,
  mockedSamplingSdkVersions,
} from '../testUtils';

function ComponentProviders({children}: {children: React.ReactNode}) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRecommendedSdkUpgrades', function () {
  it('works', async function () {
    const {organization, projects} = getMockInitializeOrg({
      projects: [
        TestStubs.Project({id: '1', slug: 'sentry'}),
        TestStubs.Project({id: '2', slug: 'java'}),
        TestStubs.Project({id: '3', slug: 'angular'}),
        TestStubs.Project({id: '4', slug: 'javascript'}),
      ],
    });

    ProjectsStore.loadInitialData(projects);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${projects[2].slug}/dynamic-sampling/distribution/`,
      method: 'GET',
      body: mockedSamplingDistribution,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dynamic-sampling/sdk-versions/`,
      method: 'GET',
      body: mockedSamplingSdkVersions,
    });

    const hook = reactHooks.renderHook(
      () =>
        useRecommendedSdkUpgrades({
          organization: TestStubs.Organization(),
          projectId: projects[2].id,
          projectSlug: projects[2].slug,
        }),
      {
        wrapper: ({children}) => <ComponentProviders>{children}</ComponentProviders>,
      }
    );

    await hook.waitForNextUpdate();
    await hook.waitForNextUpdate();

    expect(hook.result.current.recommendedSdkUpgrades.length).toBe(2);
    expect(hook.result.current.recommendedSdkUpgrades).toEqual([
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
    expect(hook.result.current.incompatibleProjects.length).toBe(1);
    expect(hook.result.current.incompatibleProjects).toEqual([
      expect.objectContaining({
        features: [],
        slug: 'angular',
      }),
    ]);
    expect(hook.result.current.isProjectIncompatible).toBe(true);
    expect(hook.result.current.affectedProjects.length).toBe(4);
  });
});
